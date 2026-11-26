// QA de operaciones en lote (en la tienda demo; al final la reinicia).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS); const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mostrador-sin-recorrido', '1') } catch (e) {} });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ status: 404, body: '{}' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); global.P = p; p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.click('#ver-demo'); await p.waitForSelector('.kpis', { timeout: 30000 });
  // Asegura que la demo esté recién llenada
  await p.click('#demo-reset'); await p.click('#cf-si'); await p.waitForSelector('.toast.ok >> text=Demo reiniciada', { timeout: 60000 });
  const est = n => p.evaluate(n => +M.productos.find(x => x.nombre === n).existencia, n);
  // ===== 1) Alertas: cambio del proveedor en lote =====
  await p.goto(BASE + '#/alertas'); await p.waitForSelector('#a-l .list');
  const cajas = await p.$$('#a-l [data-sel]'); ok('Alertas con casillas para seleccionar', cajas.length >= 5, String(cajas.length));
  const leche0 = await est('Leche Lala Entera 1 L'), jamon0 = await est('Jamón de pavo FUD 290 g');
  await p.check('.li:has-text("Leche Lala Entera 1 L") [data-sel] >> nth=0'); await p.check('.li:has-text("Jamón de pavo FUD") [data-sel]');
  await p.waitForSelector('#selbar'); ok('Barra con 2 seleccionados', (await p.textContent('#selbar')).includes('2 seleccionados'));
  await shot(p, 'l1-seleccion');
  await p.click('#selbar [data-sb="cambio"]'); await p.waitForSelector('#cp-l');
  const fecha = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  await p.fill('#cp-todos', fecha); await p.click('#cp-aplicar'); await p.waitForTimeout(200); await shot(p, 'l2-cambio');
  await p.click('#cp-ok'); await p.waitForSelector('.toast.ok >> text=cambios guardados', { timeout: 30000 });
  const leche1 = await est('Leche Lala Entera 1 L'), jamon1 = await est('Jamón de pavo FUD 290 g');
  ok('Cambio en lote: la existencia queda igual (sale lo viejo, entra lo nuevo)', leche1 === leche0 && jamon1 === jamon0, `leche ${leche0}→${leche1}, jamón ${jamon0}→${jamon1}`);
  const nueva = await p.evaluate(f => lotes => 0, fecha).catch(() => null);
  const fechas = await p.evaluate(() => { const L = []; document.querySelectorAll('#a-l .li').forEach(x => L.push(x.textContent)); return L.join(' | ') });
  ok('Lo cambiado ya no aparece en alertas', !/Leche Lala Entera 1 L6 pzas · caduca/.test(fechas));
  // ===== 2) Sacar varios vencidos / por vencer =====
  const yog0 = await est('Yoghurt Lala Fresa 1 kg'), tor0 = await est('Tortillas de maíz');
  await p.check('.li:has-text("Yoghurt Lala Fresa") [data-sel] >> nth=0'); await p.check('.li:has-text("Tortillas de maíz") [data-sel] >> nth=0');
  await p.click('#selbar [data-sb="merma"]'); await p.click('#cf-si'); await p.waitForSelector('.toast.ok >> text=lotes sacados', { timeout: 30000 });
  const yog1 = await est('Yoghurt Lala Fresa 1 kg'), tor1 = await est('Tortillas de maíz');
  ok('Sacar en lote descuenta del inventario', yog1 < yog0 && tor1 < tor0, `yoghurt ${yog0}→${yog1}, tortillas ${tor0}→${tor1}`);
  // ===== 3) Pedir cambio a varios proveedores =====
  const sel = await p.$$('#a-l [data-sel]'); for (const c of sel.slice(0, 3)) await c.check();
  await p.click('#selbar [data-sb="wa"]'); await p.waitForSelector('.sheet .list a.li');
  ok('Pedir cambio: un mensaje por proveedor', (await p.$$('.sheet .list a.li')).length >= 1, (await p.textContent('.sheet .list')).replace(/\s+/g, ' ').slice(0, 80));
  await shot(p, 'l3-pedir'); await p.click('.sheet-x'); await p.click('#selbar [data-sb="x"]');
  // ===== 4) Productos: cambiar precio a varios =====
  await p.goto(BASE + '#/productos'); await p.waitForSelector('#p-sel'); await p.click('#p-sel');
  const nombres = ['Coca-Cola 355 ml', 'Sabritas Original 45 g', 'Agua Ciel 1 L'];
  const antes = await p.evaluate(ns => ns.map(n => +M.productos.find(x => x.nombre === n).precio), nombres);
  for (const n of nombres) await p.click(`.list .li:has-text("${n}")`);
  await p.waitForSelector('#selbar'); ok('Seleccionar productos', (await p.textContent('#selbar')).includes('3 productos'));
  await shot(p, 'l4-sel-productos');
  await p.click('#selbar [data-sb="editar"]'); await p.selectOption('#el [name=pmodo]', 'sube'); await p.fill('#el [name=pval]', '10'); await p.fill('#el [name=categoria]', 'Promoción QA');
  await p.waitForTimeout(150); await shot(p, 'l5-editar-lote');
  await p.click('#el-ok'); await p.waitForSelector('.toast.ok >> text=productos actualizados', { timeout: 30000 });
  const despues = await p.evaluate(ns => ns.map(n => { const x = M.productos.find(y => y.nombre === n); return [+x.precio, x.categoria] }), nombres);
  ok('Subir 10% y cambiar categoría a 3 productos', despues.every((d, i) => d[0] === Math.round(antes[i] * 1.1 * 2) / 2 && d[1] === 'Promoción QA'), JSON.stringify(antes) + ' → ' + JSON.stringify(despues.map(d => d[0])));
  // ===== 5) Agregar varios =====
  await p.click('#p-varios'); await p.waitForSelector('#altalote', { state: 'attached' });
  await p.fill('#al-man input', '0049505090703'); await p.click('#al-man button'); await p.waitForTimeout(1500);
  await p.fill('#al-man input', '7509999000017'); await p.click('#al-man button'); await p.waitForTimeout(800);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.type('7509999000024', { delay: 8 }); await p.keyboard.press('Enter'); await p.waitForTimeout(800);   // pistola
  await p.click('#al-sin'); await p.waitForTimeout(200);
  const filas = await p.$$('#al-l [data-i]'); ok('Agregar varios: escaneados + pistola + sin código', filas.length === 4, String(filas.length));
  const nombreCat = await p.inputValue('#al-l [data-i="3"] [data-k=nombre]'); ok('El del catálogo trae su nombre solo', /leche/i.test(nombreCat), nombreCat);
  const datos = [['Producto sin código QA', '15', '3'], ['Pistola QA', '12', '5'], ['Nuevo QA', '20', '10'], [null, '35', '6']];
  for (let i = 0; i < 4; i++) { const c = `#al-l [data-i="${i}"]`; if (datos[i][0]) await p.fill(c + ' [data-k=nombre]', datos[i][0]); await p.fill(c + ' [data-k=precio]', datos[i][1]); await p.fill(c + ' [data-k=existencia]', datos[i][2]) }
  await shot(p, 'l6-agregar-varios');
  await p.click('#al-ok'); const conf = await p.$('#cf-si'); if (conf) await conf.click();
  await p.waitForSelector('.toast.ok >> text=productos agregados', { timeout: 30000 });
  const agregados = await p.evaluate(() => ['Producto sin código QA', 'Pistola QA', 'Nuevo QA'].map(n => { const x = M.productos.find(y => y.nombre === n); return x ? +x.existencia : null }));
  ok('Se guardan todos con su existencia', JSON.stringify(agregados) === '[3,5,10]', JSON.stringify(agregados));
  const cats = await p.evaluate(() => ['Producto sin código QA', 'Pistola QA', 'Nuevo QA'].map(n => M.productos.find(y => y.nombre === n).categoria));
  ok('Cada renglón guarda sus propios datos (no se recorren)', cats.every(c => c === 'General'), JSON.stringify(cats));
  // Escritorio
  await p.setViewportSize({ width: 1280, height: 800 }); await p.goto(BASE + '#/alertas'); await p.waitForSelector('#a-l .list'); await p.check('#a-l [data-sel] >> nth=0'); await p.check('#a-l [data-sel] >> nth=1');
  await p.waitForTimeout(300); await shot(p, 'l7-desk-alertas');
  // Deja la demo como nueva
  await p.click('#demo-reset'); await p.click('#cf-si'); await p.waitForSelector('.toast.ok >> text=Demo reiniciada', { timeout: 60000 });
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.log('FALLO', e.message.split('\n')[0]); process.exit(1) });
