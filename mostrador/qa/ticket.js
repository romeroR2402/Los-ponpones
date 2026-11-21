// QA de "Foto del ticket": genera la imagen de un ticket de proveedor, la lee con Tesseract (real) y revisa
// que los renglones se emparejen con los productos de la tienda demo y pasen a la entrada.
// Uso: SUPABASE_JS=... TESS_DIR=<carpeta con tesseract.js, tesseract.js-core y @tesseract.js-data/spa desempacados> SHOTS=... node mostrador/qa/ticket.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS); const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots'); const T = process.env.TESS_DIR;
const PAQ = { 'tesseract.js': 'tesseract.js-6.0.1/package', 'tesseract.js-core': 'tesseract.js-core-6.0.0/package', '@tesseract.js-data/spa': 'tesseract.js-data-spa-1.0.0/package' };
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
const TICKET = `COCA-COLA FEMSA
RUTA 1234 VENDEDOR 55
FECHA 21/11/2026 FOLIO 88213
CANT DESCRIPCION        P.UNIT  IMPORTE
24 COCA COLA 355 ML      13.50   324.00
12 COCA COLA 2 L         32.00   384.00
6  AGUA CIEL 1 L          8.50    51.00
12 DEL VALLE DURAZNO 1 L 19.00   228.00
6  FANTA NARANJA 600 ML  12.00    72.00
SUBTOTAL                        1059.00
TOTAL                           1059.00
GRACIAS POR SU COMPRA`;
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  // 1) La "foto": un ticket térmico impreso
  const pg = await b.newPage({ viewport: { width: 520, height: 520 }, deviceScaleFactor: 2 });
  await pg.setContent(`<body style="margin:0;background:#ddd"><pre style="margin:20px;padding:18px;background:#fff;font:600 17px/1.5 'DejaVu Sans Mono',monospace;color:#222;transform:rotate(-1deg)">${TICKET}</pre></body>`);
  const foto = path.join(SHOTS, 'ticket-coca.png'); await pg.screenshot({ path: foto }); await pg.close();
  // 2) La app (demo) con el lector servido desde paquetes locales
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mostrador-sin-recorrido', '1') } catch (e) {} });
  await ctx.route('https://cdn.jsdelivr.net/npm/**', r => {
    const u = new (require('url').URL)(r.request().url()).pathname.replace(/^\/npm\//, '');
    if (u.startsWith('@supabase/')) return r.fulfill({ body: SB, contentType: 'application/javascript' });
    const m = u.match(/^(@[^/]+\/[^@/]+|[^@/]+)(?:@[^/]+)?\/(.*)$/); const dir = m && PAQ[m[1]];
    const full = dir && path.join(T, dir, m[2]);
    if (!full || !fs.existsSync(full)) { log.push('sin archivo: ' + u); return r.fulfill({ status: 404, body: '' }) }
    r.fulfill({ body: fs.readFileSync(full), contentType: full.endsWith('.wasm') ? 'application/wasm' : full.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); global.P = p; p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.click('#ver-demo'); await p.waitForSelector('.kpis', { timeout: 30000 });
  await p.goto(BASE + '#/entradas'); await p.waitForSelector('#e-foto'); await p.click('#e-foto');
  await p.waitForSelector('#tk-gal', { state: 'attached' }); await p.screenshot({ path: path.join(SHOTS, 'k1-elegir.png') });
  await p.setInputFiles('#tk-gal', foto);
  await p.waitForSelector('#tk-l', { timeout: 120000 }); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(SHOTS, 'k2-revisar.png'), fullPage: false });
  if (process.env.VER_TEXTO) log.push('TEXTO:\n' + await p.$eval('details pre', x => x.textContent));
  const filas = await p.$$eval('#tk-l [data-i]', ds => ds.map(d => ({ n: d.querySelector('[data-k=nombre]').value, c: d.querySelector('[data-k=cantidad]').value, u: d.querySelector('[data-k=costo]').value, p: d.querySelector('[data-k=producto]').selectedOptions[0].text })));
  log.push('Leído: ' + filas.map(f => `${f.c} × ${f.n} @ ${f.u} → ${f.p}`).join(' | '));
  ok('Encuentra los 5 renglones', filas.length === 5, String(filas.length));
  ok('Cantidades y costos correctos', ['24|13.5', '12|32', '6|8.5', '12|19', '6|12'].every((x, i) => filas[i] && `${+filas[i].c}|${+filas[i].u}` === x));
  ok('Empareja con los productos de la tienda', filas[0]?.p === 'Coca-Cola 355 ml' && filas[1]?.p === 'Coca-Cola 2 L' && filas[2]?.p === 'Agua Ciel 1 L' && /Del Valle/.test(filas[3]?.p || ''));
  ok('Lo que no tiene queda como producto nuevo', /Producto nuevo/.test(filas[4]?.p || ''));
  ok('Detecta el TOTAL y cuadra', !(await p.textContent('#tk-w')).trim() && (await p.textContent('#tk-s')).includes('1,059.00'), await p.textContent('#tk-s'));
  const antes = await p.evaluate(() => M.productos.find(x => x.nombre === 'Coca-Cola 355 ml').existencia);
  await p.click('#tk-ok'); await p.waitForSelector('#e-lineas [data-i]');
  const lineas = await p.$$eval('#e-lineas [data-i]', ds => ds.length);
  const prov = await p.$eval('#e-prov', s => s.selectedOptions[0].text);
  ok('Pasa los 5 a la entrada y reconoce al proveedor', lineas === 5 && /Coca-Cola FEMSA/.test(prov), lineas + ' · ' + prov);
  await p.screenshot({ path: path.join(SHOTS, 'k3-entrada.png') });
  await p.click('#e-guardar'); const conf = await p.$('#cf-si'); if (conf) await p.click('#cf-si');
  await p.waitForSelector('.toast.ok >> text=Entrada guardada', { timeout: 30000 });
  const despues = await p.evaluate(() => M.productos.find(x => x.nombre === 'Coca-Cola 355 ml').existencia);
  ok('Al guardar suma al inventario (+24 Coca-Cola 355 ml)', +despues === +antes + 24, `${antes} → ${despues}`);
  ok('Se dio de alta la Fanta nueva', await p.evaluate(() => !!M.productos.find(x => /fanta/i.test(x.nombre))));
  await p.click('#demo-reset').catch(() => {}); const si = await p.$('#cf-si'); if (si) { await si.click(); await p.waitForSelector('.toast.ok >> text=Demo reiniciada', { timeout: 60000 }) }
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.log('FALLO', e.message.split('\n')[0]); process.exit(1) });
