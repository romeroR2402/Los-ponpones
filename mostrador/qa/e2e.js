const { chromium } = require('playwright');
const fs = require('fs');
const SB = fs.readFileSync(process.env.SUPABASE_JS || require.resolve('@supabase/supabase-js/dist/umd/supabase.js'));
const URL = 'http://localhost:8080/mostrador/';
const hoy = new Date(); const iso = d => new Date(hoy.getTime() + d*864e5).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
const log = []; const ok = (n, c, d='') => { log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : '')); };
async function nueva(b, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mostrador-sin-recorrido', '1') } catch (e) {} });
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ status: 404, body: '{}' }));
  const p = await ctx.newPage(); global.P = p;
  p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|ERR_|Failed to load/.test(m.text())) log.push('CONSOLE ' + m.text()) });
  p.on('dialog', d => d.accept());
  return { ctx, p };
}
const shot = (p, n) => p.screenshot({ path: __dirname + '/shots/' + n + '.png', fullPage: false });
async function entrar(p, email) {
  await p.goto(URL); await p.waitForSelector('#fa');
  await p.fill('[name=email]', email); await p.fill('[name=pass]', 'PruebaQA-2026'); await p.click("#fa button.btn");
}
async function onboarding(p, giroTxt, nombre, quitarCaps = []) {
  await p.waitForSelector('.giro'); await p.click(`.giro:has-text("${giroTxt}")`);
  await p.fill('[name=nombre]', nombre); await p.fill('[name=municipio]', 'Iztapalapa'); await p.click('button:has-text("Continuar")');
  await p.waitForSelector('#caps');
  for (const c of quitarCaps) await p.uncheck(`[name=${c}]`);
  return p;
}
async function nuevoProducto(p, d) {
  await p.goto(URL + '#/productos'); await p.waitForSelector('#p-nuevo'); await p.click('#p-nuevo'); await p.waitForSelector('#fp');
  if (d.codigo) await p.fill('#fp [name=codigo]', d.codigo);
  await p.fill('#fp [name=nombre]', d.nombre);
  if (d.categoria) await p.fill('#fp [name=categoria]', d.categoria);
  if (d.unidad) await p.selectOption('#fp [name=unidad]', d.unidad);
  await p.fill('#fp [name=precio]', String(d.precio)); if (d.costo) await p.fill('#fp [name=costo]', String(d.costo));
  if (d.minimo != null) await p.fill('#fp [name=minimo]', String(d.minimo));
  if (d.existencia) await p.fill('#fp [name=existencia]', String(d.existencia));
  if (d.caduca) { await p.check('#fp [name=maneja_caducidad]'); await p.fill('#fp [name=caducidad]', d.caduca) }
  if (d.receta) await p.check('#fp [name=at_requiereReceta]');
  if (d.sustancia) await p.fill('#fp [name=at_sustancia]', d.sustancia);
  await p.click('#fp-ok'); await p.waitForSelector('#sheet', { state: 'detached' });
}
(async () => {
  fs.mkdirSync(__dirname + '/shots', { recursive: true });
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  // ================= A: ABARROTES (móvil) =================
  let { ctx, p } = await nueva(b, { width: 360, height: 780 });
  await p.goto(URL); await p.waitForSelector('#fa'); await shot(p, '01-acceso');
  await p.click('text=Crear cuenta'); await p.fill('[name=nombre]', 'X'); await p.fill('[name=email]', 'nuevo-qa@usuarios.mostrador.app'); await p.fill('[name=pass]', 'abcdef12');
  await p.click('button:has-text("Crear mi cuenta")'); await p.waitForSelector('.toast'); ok('Registro cerrado muestra mensaje claro', true, await p.textContent('.toast'));
  await p.click('.tabs button[data-m=entrar]');
  await entrar(p, 'qa-abarrotes@usuarios.mostrador.app');
  await p.waitForSelector('.giro'); await shot(p, '02-onb-giro');
  await onboarding(p, 'Tienda de abarrotes', 'Abarrotes Doña Lupe');
  const caps = await p.$$eval('#caps input', is => is.map(i => i.name + ':' + i.checked));
  ok('Abarrotes trae caducidad, granel, fiado y reclamo prendidos', ['caducidad:true', 'reclamoProveedor:true', 'granel:true', 'fiado:true'].every(c => caps.includes(c)), caps.join(' '));
  await shot(p, '03-onb-caps');
  await p.click('#crear'); await p.waitForSelector('.kpis'); await shot(p, '04-listo');
  await p.waitForSelector('.kpis'); await shot(p, '05-inicio-vacio');
  const tabs = await p.$$eval('.tabbar a', as => as.map(a => a.textContent.trim()));
  ok('Barra inferior móvil', tabs.length === 5, tabs.join(' | '));
  await nuevoProducto(p, { codigo: '7501055300075', nombre: 'Leche entera 1 L', categoria: 'Lácteos', precio: 28, costo: 22, minimo: 3, existencia: 10, caduca: iso(3) });
  await nuevoProducto(p, { nombre: 'Jamón de pavo', categoria: 'Salchichonería', unidad: 'kg', precio: 180, costo: 120, minimo: 0.5, existencia: 2 });
  await nuevoProducto(p, { codigo: '7501055300099', nombre: 'Refresco cola 600 ml', categoria: 'Bebidas', precio: 18, costo: 13, minimo: 6, existencia: 4 });
  await nuevoProducto(p, { nombre: 'Yogurt fresa', categoria: 'Lácteos', precio: 12, costo: 8, minimo: 2, existencia: 5, caduca: iso(-1) });
  // validación
  await p.click('#p-nuevo'); await p.fill('#fp [name=nombre]', 'Sin precio'); await p.click('#fp-ok'); await p.waitForSelector('.toast.bad');
  ok('Validación: no guarda sin precio', true, await p.textContent('.toast.bad')); await p.click('.sheet-x');
  await p.click('#p-nuevo'); await p.fill('#fp [name=codigo]', '7501055300075'); await p.fill('#fp [name=nombre]', 'Duplicado'); await p.fill('#fp [name=precio]', '5'); await p.click('#fp-ok');
  await p.waitForSelector('.toast.bad >> text=Ese código'); ok('Validación: código repetido', true); await p.click('.sheet-x');
  await p.waitForTimeout(400); await shot(p, '06-productos');
  // ---- Vender ----
  await p.goto(URL + '#/vender'); await p.waitForSelector('#v-q');
  await p.fill('#v-q', '7501055300075'); await p.press('#v-q', 'Enter');
  await p.click('.pcard:has-text("Jamón")'); await p.waitForSelector('#pc');
  await p.click('.sheet .tabs button[data-m=d]'); await p.fill('#pc-v', '45'); const jt = await p.textContent('#pc-t');
  ok('Granel por dinero: $45 de jamón = 0.25 kg', /0[.,]25 kg/.test(jt), jt); await p.click('#pc button.btn');
  await p.waitForSelector('#v-ver'); await shot(p, '07-vender');
  const bar = await p.textContent('#v-ver'); ok('Total 28 + 45 = 73', bar.includes('$73.00'), bar);
  await p.click('#v-ver'); await p.waitForSelector('#sheet [data-cobrar]'); await shot(p, '08-carrito');
  await p.click('#sheet [data-cobrar]'); await p.waitForSelector('#c-rec'); await p.fill('#c-rec', '100');
  ok('Cambio de $100', (await p.textContent('#c-cam')).includes('$27.00'), await p.textContent('#c-cam')); await shot(p, '09-cobrar');
  await p.click('#c-ok'); await p.waitForSelector('.done'); await p.waitForTimeout(500); await shot(p, '10-venta-ok');
  ok('Ticket con folio', /Venta #1/.test(await p.textContent('.ticket')), (await p.textContent('.ticket')).slice(0, 80));
  await p.click('.done ~ .acts button');
  // ---- Fiado ----
  await p.fill('#v-q', 'refresco'); await p.press('#v-q', 'Enter'); await p.click('#v-ver'); await p.click('#sheet [data-cobrar]');
  await p.click('.pay[data-p=fiado]'); await p.click('#c-ok'); await p.waitForSelector('.toast.bad'); ok('Fiado exige nombre', true);
  await p.fill('#c-cli', 'Don Chucho'); await p.click('#c-ok'); await p.waitForSelector('.done'); await p.click('.done ~ .acts button');
  // ---- Sin internet ----
  await ctx.setOffline(true);
  await p.fill('#v-q', 'refresco'); await p.press('#v-q', 'Enter'); await p.click('#v-ver'); await p.click('#sheet [data-cobrar]'); await p.click('#c-ok');
  await p.waitForSelector('.done'); const offTxt = await p.textContent('.done'); ok('Venta sin internet se guarda', /Sin internet/.test(offTxt));
  await p.click('.done ~ .acts button'); await p.waitForTimeout(300);
  ok('Indicador sin internet', /Sin internet · 1 por subir/.test(await p.textContent('#net')), await p.textContent('#net')); await shot(p, '11-offline');
  await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(3000);
  ok('Al volver internet se sube', (await p.evaluate(() => M.cola().length)) === 0);
  // ---- Entrada con XML ----
  await p.goto(URL + '#/entradas'); await p.waitForSelector('#e-xml', { state: 'attached' });
  await p.setInputFiles('#e-xml', __dirname + '/factura-ejemplo.xml'); await p.waitForSelector('#e-crear-todos');
  ok('XML: reconoce 1 existente y 2 nuevos', (await p.$$('.li [data-crear]')).length === 2 && (await p.$$('#e-lineas [data-i]')).length === 1);
  await p.click('#e-crear-todos'); await p.waitForFunction(() => document.querySelectorAll('#e-lineas [data-i]').length === 3);
  const prov = await p.$eval('#e-prov', s => s.options[s.selectedIndex].text); ok('XML: crea proveedor del emisor', /DISTRIBUIDORA LACTEA/.test(prov), prov);
  await p.fill('#e-lineas [data-i="0"] [data-k=caducidad]', iso(2)); await p.check('#e-lineas [data-i="0"] [data-k=cambio]');
  await shot(p, '12-entrada-xml');
  await p.click('#e-guardar'); await p.waitForSelector('.toast.ok >> text=Entrada guardada');
  const lecheEx = await p.evaluate(() => M.productos.find(x => x.codigo === '7501055300075').existencia);
  ok('Existencia leche = 10 - 1 + 12 = 21', Number(lecheEx) === 21, lecheEx);
  const gal = await p.evaluate(() => { const g = M.productos.find(x => x.codigo === '7501000611010'); return g && [g.costo, g.precio] });
  ok('Costo con IVA desde XML (15 + 16% = 17.40) y precio sugerido', gal && Number(gal[0]) === 17.4 && Number(gal[1]) === 23, JSON.stringify(gal));
  // repetir misma factura
  await p.goto(URL + '#/entradas'); await p.waitForSelector('#e-xml', { state: 'attached' }); await p.setInputFiles('#e-xml', __dirname + '/factura-ejemplo.xml');
  await p.waitForSelector('.toast.bad'); ok('Misma factura dos veces se bloquea al subirla', true, await p.textContent('.toast.bad'));
  // ---- Alertas ----
  await p.goto(URL + '#/alertas'); await p.waitForSelector('#a-l .list'); await shot(p, '13-alertas');
  const al = await p.textContent('#a-l');
  ok('Alerta cambio con proveedor', al.includes('Pídele el cambio'), ''); ok('Alerta vencidos (yogurt)', al.includes('Ya vencieron') && al.includes('Yogurt'));
  ok('Alerta vencen pronto (leche 3 días)', al.includes('Vencen pronto')); ok('Alerta se acaba (refresco 2 ≤ 6)', al.includes('Se están acabando') && al.includes('Refresco'));
  const badge = await p.textContent('.tabbar [data-n]'); ok('Contador en la barra', Number(badge) > 0, badge);
  await p.click('.li:has-text("Yogurt") [data-acc=merma]'); await p.click('#cf-si'); await p.waitForSelector('.toast.ok >> text=Listo ✓');
  ok('Sacar vencido deja yogurt en 0', Number(await p.evaluate(() => M.productos.find(x => x.nombre === 'Yogurt fresa').existencia)) === 0);
  await p.goto(URL + '#/inicio'); await p.waitForSelector('#i-ven .list'); await shot(p, '14-inicio');
  // ---- Escritorio ----
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto(URL + '#/inicio'); await p.waitForSelector('#i-ven .list'); await shot(p, '15-desk-inicio');
  await p.goto(URL + '#/productos'); await p.waitForSelector('table.tbl'); await shot(p, '16-desk-productos');
  await p.goto(URL + '#/vender'); await p.waitForSelector('.pcard'); await p.click('.pcard:has-text("Galletas")'); await p.click('.pcard:has-text("Galletas")'); await shot(p, '17-desk-vender');
  await p.goto(URL + '#/ventas'); await p.waitForSelector('#vs-c .kpis'); await shot(p, '18-desk-ventas');
  const vtot = await p.textContent('#vs-c .kpi.dark b'); ok('Ventas del día = 73 + 18 + 18 = 109', vtot.includes('$109.00'), vtot);
  await p.click('#vs-c [data-v]'); await p.click('#vv-c'); await p.click('#cf-si'); await p.waitForSelector('.toast.ok >> text=cancelada');
  ok('Cancelar venta regresa stock (refresco 2 → 3)', Number(await p.evaluate(() => M.productos.find(x => x.nombre.startsWith('Refresco')).existencia)) === 3);
  await p.goto(URL + '#/ajustes'); await p.waitForSelector('#aj'); await shot(p, '19-desk-ajustes');
  await p.uncheck('[name=cap_fiado]'); await p.click('#aj button.btn.lg'); await p.waitForSelector('.toast.ok >> text=Cambios guardados');
  await p.goto(URL + '#/vender'); await p.click('.pcard:has-text("Galletas")'); await p.click('[data-cobrar]');
  ok('Al apagar fiado desaparece del cobro', !(await p.$('.pay[data-p=fiado]'))); await p.click('.sheet-x');
  await ctx.close();

  // ================= B: FARMACIA (móvil) =================
  ({ ctx, p } = await nueva(b, { width: 390, height: 844 }));
  await entrar(p, 'qa-farmacia@usuarios.mostrador.app'); await onboarding(p, 'Farmacia', 'Farmacia San Toño');
  const capsB = await p.$$eval('#caps input', is => is.map(i => i.name + ':' + i.checked));
  ok('Farmacia: receta y caducidad prendidas, sin granel', capsB.includes('receta:true') && capsB.includes('caducidad:true') && capsB.includes('granel:false'), capsB.join(' '));
  await p.click('#crear'); await p.waitForSelector('.kpis');
  await p.goto(URL + '#/productos'); await p.waitForSelector('#p-lista');
  ok('Aislamiento: Farmacia no ve productos de Abarrotes', (await p.evaluate(() => M.productos.length)) === 0);
  await p.click('#p-nuevo'); await p.waitForSelector('#fp');
  const campos = await p.$$eval('#fp label.f > span, #fp .check b', s => s.map(x => x.textContent.trim()));
  ok('Formulario farmacia con sustancia activa y receta', campos.includes('Sustancia activa') && campos.includes('Requiere receta'), campos.join(', '));
  const unidades = await p.$$eval('#fp [name=unidad] option', o => o.map(x => x.value)); ok('Farmacia sin kg/m', !unidades.includes('kg') && !unidades.includes('m'), unidades.join(','));
  await shot(p, '20-farm-form'); await p.click('.sheet-x');
  await nuevoProducto(p, { nombre: 'Amoxicilina 500 mg 12 caps', categoria: 'Antibióticos', precio: 95, costo: 60, existencia: 10, caduca: iso(120), receta: true, sustancia: 'Amoxicilina' });
  await p.goto(URL + '#/vender'); await p.click('.pcard:has-text("Amoxicilina")'); await p.click('#v-ver'); await p.click('#sheet [data-cobrar]');
  await p.waitForSelector('#c-receta'); await p.click('#c-ok'); await p.waitForSelector('.toast.bad >> text=receta'); ok('Venta con receta exige confirmación', true);
  await shot(p, '21-farm-receta'); await p.check('#c-receta'); await p.click('#c-ok'); await p.waitForSelector('.done');
  ok('Folio propio por negocio (#1)', /Venta #1/.test(await p.textContent('.ticket')));
  await p.click('.done ~ .acts button');
  // atajo por URL a módulo inexistente / acceso directo
  const r = await p.evaluate(async () => { const q = await M.sb.from('mos_ventas').select('id,negocio_id'); return q.data.map(x => x.negocio_id === M.negocio.id) });
  ok('API: sólo ve sus propias ventas', r.every(Boolean) && r.length === 1, JSON.stringify(r));
  await p.click('#mas'); await p.click('#mm-salir'); await p.waitForSelector('#fa');
  ok('Al salir se borran datos locales', (await p.evaluate(() => Object.keys(localStorage).filter(k => /mostrador-(productos|lotes|negocio)/.test(k)).length)) === 0);
  await ctx.close(); await b.close();
  console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: __dirname + '/shots/fallo.png' }) } catch (x) {} console.log(log.join('\n')); console.error('FALLO:', e.message.split('\n')[0]); process.exit(1) });
