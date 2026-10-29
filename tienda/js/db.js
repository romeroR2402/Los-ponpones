// Capa de datos compartida por la tienda (index.html) y el panel (admin.html).
// Usa Supabase si está configurado en config.js; si no, MODO DEMO con datos en este navegador.
(function () {
  const CFG = window.TIENDA || {};
  const sb = CFG.url && window.supabase ? window.supabase.createClient(CFG.url, CFG.key) : null;

  const CATEGORIAS = ['Playeras', 'Sudaderas', 'Suéteres', 'Pantalones', 'Bolsas'];
  const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

  const AJUSTES_DEMO = {
    nombre: 'SERIGRAFÍA', lema: 'Estampados', banco: 'BBVA', titular: 'Tu nombre completo',
    clabe: '012345678901234567', cuenta: '0123456789', tarjeta: '', whatsapp: '', envio: 0,
    nota_pago: 'Haz tu transferencia y sube la foto de tu comprobante. Confirmamos tu pedido en menos de 24 h.'
  };
  const c = (n, h) => ({ nombre: n, hex: h });
  const T_NINO = ['2', '4', '6', '8', '10', '12', '14', 'CH', 'M', 'G', 'XG'];
  const PRODUCTOS_DEMO = [
    { id: 'p-huntrix', nombre: 'Playera Huntrix', categoria: 'Playeras', precio: 199, precio_antes: null, tallas: T_NINO, colores: [c('Rosa', '#e8318a')], detalle: 'Algodón · Estampado a todo color', descripcion: 'Playera rosa con diseño de Huntrix, estampado a todo color. Tallas para niña, niño y adulto.', destacado: true, activo: true, imagenes: ['img/huntrix-rosa.jpg'] },
    { id: 'p-bluey', nombre: 'Playera Bluey Catrín', categoria: 'Playeras', precio: 199, precio_antes: null, tallas: T_NINO, colores: [c('Verde limón', '#7ed321')], detalle: 'Algodón · Edición Día de Muertos', descripcion: 'Playera verde con Bluey vestido de catrín y su guitarra. Edición especial Día de Muertos.', destacado: true, activo: true, imagenes: ['img/bluey-verde.jpg'] },
    { id: 'p-xolo', nombre: 'Playera Xolo Papel Picado', categoria: 'Playeras', precio: 199, precio_antes: null, tallas: T_NINO, colores: [c('Negro', '#1d1d1f'), c('Morado', '#6a2bc4')], detalle: 'Algodón · Serigrafía naranja', descripcion: 'Xoloitzcuintle estilo papel picado en serigrafía naranja. Disponible en negro y morado.', destacado: true, activo: true, imagenes: ['img/xolo-negra.jpg', 'img/xolo-morada.jpg'] }
  ];

  // ---------- almacenamiento local seguro ----------
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  const demoProductos = () => ls.get('tienda_demo_productos_v2', PRODUCTOS_DEMO);
  const demoPedidos = () => ls.get('tienda_demo_pedidos', []);

  let demo = !sb;
  function chk({ data, error }) { if (error) throw new Error(error.message); return data; }
  const rnd = () => Math.random().toString(36).slice(2, 8);

  // Reduce fotos grandes (las de celular pesan 4–10 MB) antes de subirlas
  async function comprimir(file, max = 1600, calidad = 0.85) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', calidad));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }
  const aBase64 = f => new Promise((ok, no) => {
    const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f);
  });
  const aDataURL = f => new Promise((ok, no) => {
    const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f);
  });

  const api = {
    CATEGORIAS, ESTADOS, comprimir, ls,
    get demo() { return demo; },

    async productos() {
      if (!demo) {
        try {
          return chk(await sb.from('tienda_productos').select('*').order('orden').order('creado', { ascending: false }));
        } catch (e) { console.warn('Supabase sin tablas, usando modo demo:', e.message); demo = true; }
      }
      return demoProductos();
    },

    async ajustes() {
      if (!demo) {
        try { return chk(await sb.from('tienda_ajustes').select('*').eq('id', 1).single()); }
        catch (e) { demo = true; }
      }
      return ls.get('tienda_demo_ajustes', AJUSTES_DEMO);
    },

    // Sube el comprobante a Supabase (privado) y lo manda a tu Google Drive
    async subirComprobante(file, meta) {
      const f = await comprimir(file);
      const res = { ruta: null, drive: null };
      const tareas = [];
      if (!demo) {
        const ruta = new Date().toISOString().slice(0, 7) + '/' + Date.now() + '-' + rnd() + '.' + (f.name.split('.').pop() || 'jpg');
        tareas.push(sb.storage.from('comprobantes').upload(ruta, f, { contentType: f.type, upsert: false })
          .then(r => { if (r.error) throw new Error(r.error.message); res.ruta = ruta; }));
      } else {
        tareas.push(aDataURL(f).then(u => { res.ruta = u; }));
      }
      if (CFG.driveUrl) {
        tareas.push(aBase64(f).then(b64 => fetch(CFG.driveUrl, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ clave: CFG.driveClave, base64: b64, tipo: f.type,
            nombre: (meta.cliente || 'cliente') + ' ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '.' + (f.name.split('.').pop() || 'jpg'),
            cliente: meta.cliente, telefono: meta.telefono, total: meta.total })
        })).then(r => r.json()).then(j => { if (j.ok) res.drive = j.url; else console.warn('Drive:', j.error); })
          .catch(e => console.warn('Drive no respondió', e)));
      }
      const r = await Promise.allSettled(tareas);
      if (!res.ruta && !res.drive) throw new Error((r[0].reason && r[0].reason.message) || 'No se pudo subir el comprobante');
      return res;
    },

    async crearPedido(p) {
      if (!demo) {
        return chk(await sb.rpc('tienda_crear_pedido', {
          p_cliente: p.cliente, p_telefono: p.telefono, p_direccion: p.direccion, p_notas: p.notas,
          p_items: p.items.map(i => ({ id: i.id, talla: i.talla, color: i.color, cant: i.cant })),
          p_comprobante: p.comprobante, p_drive_url: p.drive
        }));
      }
      const prods = demoProductos(), aj = await api.ajustes();
      const items = p.items.map(i => { const x = prods.find(z => z.id === i.id); return { ...i, nombre: x.nombre, precio: x.precio, imagen: x.imagenes[0] }; });
      const subtotal = items.reduce((s, i) => s + i.precio * i.cant, 0);
      const folio = 'P-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + rnd().slice(0, 4).toUpperCase();
      const lista = demoPedidos();
      lista.unshift({ id: rnd(), folio, cliente: p.cliente, telefono: p.telefono, direccion: p.direccion, notas: p.notas, items,
        subtotal, envio: +aj.envio || 0, total: subtotal + (+aj.envio || 0), comprobante: p.comprobante, drive_url: p.drive,
        estado: 'pendiente', creado: new Date().toISOString() });
      ls.set('tienda_demo_pedidos', lista);
      return folio;
    },

    async verPedido(folio, telefono) {
      if (!demo) return chk(await sb.rpc('tienda_ver_pedido', { p_folio: folio, p_telefono: telefono }))[0] || null;
      const d = s => String(s).replace(/\D/g, '').slice(-10);
      return demoPedidos().find(x => x.folio === folio.trim().toUpperCase() && d(x.telefono) === d(telefono)) || null;
    },

    // ---------------- Panel de administración ----------------
    async sesion() {
      if (demo) return ls.get('tienda_demo_sesion', null);
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const ok = await sb.rpc('tienda_es_admin');
      return ok.data ? data.session.user : { ...data.session.user, noAdmin: true };
    },
    async entrar(email, pass) {
      if (demo) { ls.set('tienda_demo_sesion', { email }); return; }
      chk(await sb.auth.signInWithPassword({ email, password: pass }));
    },
    async salir() { if (demo) ls.set('tienda_demo_sesion', null); else await sb.auth.signOut(); },

    async subirFoto(file) {
      const f = await comprimir(file, 1400, 0.86);
      if (demo) return aDataURL(await comprimir(file, 700, 0.8));
      const ruta = Date.now() + '-' + rnd() + '.jpg';
      chk(await sb.storage.from('productos').upload(ruta, f, { contentType: f.type }));
      return sb.storage.from('productos').getPublicUrl(ruta).data.publicUrl;
    },
    async guardarProducto(p) {
      const datos = { ...p }; delete datos.id; delete datos.creado;
      if (demo) {
        const l = demoProductos();
        if (p.id) Object.assign(l.find(x => x.id === p.id), datos); else l.unshift({ id: rnd(), ...datos });
        ls.set('tienda_demo_productos_v2', l); return;
      }
      if (p.id) chk(await sb.from('tienda_productos').update(datos).eq('id', p.id));
      else chk(await sb.from('tienda_productos').insert(datos));
    },
    async borrarProducto(id) {
      if (demo) { ls.set('tienda_demo_productos_v2', demoProductos().filter(x => x.id !== id)); return; }
      chk(await sb.from('tienda_productos').delete().eq('id', id));
    },
    async pedidos() {
      if (demo) return demoPedidos();
      return chk(await sb.from('tienda_pedidos').select('*').order('creado', { ascending: false }).limit(300));
    },
    async cambiarEstado(id, estado) {
      if (demo) { const l = demoPedidos(); l.find(x => x.id === id).estado = estado; ls.set('tienda_demo_pedidos', l); return; }
      chk(await sb.from('tienda_pedidos').update({ estado }).eq('id', id));
    },
    async urlComprobante(ruta) {
      if (!ruta) return null;
      if (demo || ruta.startsWith('data:') || ruta.startsWith('http')) return ruta;
      return chk(await sb.storage.from('comprobantes').createSignedUrl(ruta, 3600)).signedUrl;
    },
    async guardarAjustes(a) {
      if (demo) { ls.set('tienda_demo_ajustes', a); return; }
      const datos = { ...a }; delete datos.id;
      chk(await sb.from('tienda_ajustes').update(datos).eq('id', 1));
    }
  };

  // ---------- Dibujo de prenda (cuando el producto aún no tiene foto) ----------
  function contraste(hex) {
    const h = (hex || '#888').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return l > 0.6 ? '#2b2522' : '#f6f1ea';
  }
  api.prendaSVG = function (cat, hex) {
    hex = hex || '#cfc8bf';
    const tinta = contraste(hex), borde = 'rgba(0,0,0,.18)';
    const cuerpo = {
      Playeras: 'M70 32 50 38 20 66 38 88 56 76v100h88V76l18 12 18-22-30-28-20-6q-30 22-60 0Z',
      Suéteres: 'M70 32 50 38 30 70 20 162l20 4 16-72v82h88V94l16 72 20-4-10-92-20-32-20-6q-30 22-60 0Z',
      Sudaderas: 'M70 32 50 38 30 70 20 162l20 4 16-72v82h88V94l16 72 20-4-10-92-20-32-20-6q-30 22-60 0Z',
      Pantalones: 'M60 22h80l12 162h-40l-12-112-12 112H48Z',
      Bolsas: 'M44 72h112l-6 108H50Z'
    }[cat] || 'M70 32 50 38 20 66 38 88 56 76v100h88V76l18 12 18-22-30-28-20-6q-30 22-60 0Z';
    let extra = '';
    if (cat === 'Sudaderas') extra = `<path d="M70 32q2-26 30-26t30 26q-30 22-60 0Z" fill="${hex}" stroke="${borde}" stroke-width="2"/><path d="M80 34q20 16 40 0" fill="none" stroke="${borde}" stroke-width="2"/><path d="M74 140h52l6 24H68Z" fill="none" stroke="${borde}" stroke-width="2"/>`;
    if (cat === 'Bolsas') extra = `<path d="M72 74q0-48 28-48t28 48" fill="none" stroke="${hex}" stroke-width="7"/><path d="M72 74q0-48 28-48t28 48" fill="none" stroke="${borde}" stroke-width="1"/>`;
    const logo = cat === 'Pantalones'
      ? `<rect x="128" y="96" width="8" height="40" rx="2" fill="${tinta}" opacity=".85"/>`
      : `<g transform="translate(100 ${cat === 'Bolsas' ? 126 : 104})" fill="${tinta}" opacity=".9"><circle r="15" fill="none" stroke="${tinta}" stroke-width="3"/><path d="M-6 6 0-8 6 6Z"/></g>`;
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><ellipse cx="100" cy="186" rx="62" ry="6" fill="rgba(0,0,0,.08)"/>${extra}<path d="${cuerpo}" fill="${hex}" stroke="${borde}" stroke-width="2" stroke-linejoin="round"/>${cat === 'Bolsas' ? '' : ''}${logo}</svg>`;
  };

  window.DB = api;
})();
