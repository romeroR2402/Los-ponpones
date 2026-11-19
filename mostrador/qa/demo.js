// QA de la tienda demo: botón "Ver la demo", datos llenos, vender, reiniciar y aislamiento.
// Uso: SUPABASE_JS=/ruta/supabase.js SHOTS=/carpeta node mostrador/qa/demo.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS || require.resolve('@supabase/supabase-js/dist/umd/supabase.js'));
const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); global.P = p; p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.waitForSelector('#ver-demo'); await shot(p, 'd0-acceso');
  await p.click('#ver-demo'); await p.waitForSelector('#i-ven .list'); await p.waitForTimeout(500);
  ok('Entra a la demo con un toque', (await p.textContent('.side .brand')).includes('La Esperanza'));
  ok('Barra de tienda de ejemplo visible', await p.isVisible('.demo-bar'));
  const hoy = await p.textContent('#k-hoy'); ok('Inicio con ventas de hoy', hoy !== '$0.00', hoy);
  const al = await p.evaluate(() => document.querySelector('#i-al').innerText);
  ok('Alertas: cambio con proveedor (leche) y vencido (yoghurt)', /Leche Lala/.test(al) && /Yoghurt/.test(al), al.slice(0, 120).replace(/\s+/g, ' '));
  await shot(p, 'd1-inicio');
  await p.goto(BASE + '#/vender'); await p.waitForSelector('.pcard'); await p.waitForTimeout(400);
  ok('Vender muestra los 53 productos', (await p.$$('.pcard')).length === 53, String((await p.$$('.pcard')).length));
  await p.click('.pcard:has-text("Coca-Cola 355 ml")'); await p.click('.pcard:has-text("Sabritas Original")'); await p.click('.pcard:has-text("Pan Blanco Bimbo")');
  await shot(p, 'd2-vender');
  await p.click('#v-cart [data-cobrar]'); await p.waitForSelector('#c-ok'); await p.click('#c-ok'); await p.waitForSelector('.done');
  ok('Venta en la demo', /Venta #\d+/.test(await p.textContent('.ticket')), (await p.textContent('.ticket')).match(/Venta #\d+/)?.[0]);
  await p.click('.done ~ .acts button');
  await p.goto(BASE + '#/productos'); await p.waitForSelector('table.tbl'); await p.waitForTimeout(300); await shot(p, 'd3-productos');
  await p.goto(BASE + '#/alertas'); await p.waitForSelector('#a-l .list'); await shot(p, 'd4-alertas');
  const alt = await p.textContent('#a-l'); ok('Alertas completas (cambio, vencidos, pronto, agotados, se acaban)', ['Pídele el cambio', 'Ya vencieron', 'Vencen pronto', 'Agotados', 'Se están acabando'].every(x => alt.includes(x)));
  await p.goto(BASE + '#/ventas'); await p.waitForSelector('#vs-c .kpis'); await p.click('[data-p="30"]'); await p.waitForTimeout(2500); await shot(p, 'd5-ventas');
  const vt = await p.textContent('#vs-c .kpi.dark b'); ok('Un mes de ventas', Number(vt.replace(/[$,]/g, '')) > 20000, vt);
  const ajenos = await p.evaluate(async () => { const r = await M.sb.from('mos_negocios').select('id,es_demo'); return r.data.filter(x => !x.es_demo).length });
  ok('La cuenta demo no ve otras tiendas', ajenos === 0, String(ajenos));
  const crea = await p.evaluate(async () => (await M.sb.rpc('mos_crear_negocio', { p: { nombre: 'x' } })).error?.message || 'pasó');
  ok('La cuenta demo no puede crear negocios', /demo/.test(crea), crea);
  // Reiniciar
  await p.goto(BASE + '#/inicio'); await p.waitForSelector('#demo-reset'); await p.click('#demo-reset'); await p.click('#cf-si');
  await p.waitForSelector('.toast.ok >> text=Demo reiniciada', { timeout: 60000 });
  const folio = await p.evaluate(() => M.negocio.ultimo_folio); ok('Reiniciar deja la demo como nueva', folio > 300, String(folio));
  // Celular
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(BASE + '#/vender'); await p.waitForSelector('.pcard'); await p.waitForTimeout(400);
  await p.click('.pcard:has-text("Leche Lala")'); await p.click('.pcard:has-text("Coca-Cola 2 L")'); await shot(p, 'd6-movil-vender');
  await p.goto(BASE + '#/inicio'); await p.waitForSelector('#i-ven .list'); await p.waitForTimeout(400); await shot(p, 'd7-movil-inicio');
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.error('FALLO', e.message.split('\n')[0]); process.exit(1) });
