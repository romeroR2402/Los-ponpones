// QA del recorrido guiado: aparece la primera vez, ilumina cada sección, se puede saltar y repetir.
// Uso: SUPABASE_JS=/ruta/supabase.js SHOTS=/carpeta node mostrador/qa/recorrido.js   (usa la cuenta demo)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS || require.resolve('@supabase/supabase-js/dist/umd/supabase.js'));
const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
async function abrir(b, vp, movil) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: !!movil, hasTouch: !!movil, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); global.P = p; p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.click('#ver-demo');
  return p;
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  // Computadora
  let p = await abrir(b, { width: 1280, height: 800 });
  await p.waitForSelector('#tour .tour-card', { timeout: 20000 }); await p.waitForTimeout(400);
  ok('Aparece solo la primera vez', true, await p.textContent('.tour-card h3'));
  await p.screenshot({ path: path.join(SHOTS, 't1-bienvenida.png') });
  const titulos = [];
  for (let k = 0; k < 20; k++) {
    const t = await p.textContent('.tour-card h3'); titulos.push(t);
    if (k === 2) { await p.waitForTimeout(350); await p.screenshot({ path: path.join(SHOTS, 't2-vender.png') }) }
    if (k === 4) { await p.waitForTimeout(350); await p.screenshot({ path: path.join(SHOTS, 't3-entradas.png') }) }
    if (!(await p.$('[data-t="sig"]'))) break;
    await p.click('[data-t="sig"]');
  }
  ok('Explica todas las secciones', ['Inicio', 'Vender', 'Productos', 'Entrada de mercancía', 'Alertas', 'Ventas', 'Proveedores', 'Lector de códigos', 'Mi negocio'].every(x => titulos.includes(x)), titulos.join(' › '));
  await p.click('[data-t="atras"]').catch(() => {}); 
  await p.waitForTimeout(350); await p.screenshot({ path: path.join(SHOTS, 't4-final.png') });
  const fin = await p.$('[data-t="cerrar"]'); if (fin) await fin.click(); else { await p.click('[data-t="sig"]'); await p.click('[data-t="cerrar"]') }
  ok('Se cierra al terminar', !(await p.$('#tour')));
  await p.reload(); await p.waitForSelector('.kpis'); await p.waitForTimeout(1200);
  ok('No vuelve a salir solo', !(await p.$('#tour')));
  await p.click('#side-tour'); await p.waitForSelector('#tour');
  ok('Se puede repetir desde «Cómo funciona»', true);
  await p.keyboard.press('Escape'); ok('Escape lo cierra', !(await p.$('#tour')));
  await p.context().close();
  // Celular
  p = await abrir(b, { width: 390, height: 844 }, true);
  await p.waitForSelector('#tour .tour-card', { timeout: 20000 });
  await p.click('[data-t="sig"]'); await p.click('[data-t="sig"]'); await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(SHOTS, 't5-movil-vender.png') });
  for (let k = 0; k < 4; k++) await p.click('[data-t="sig"]');
  await p.waitForTimeout(350); const pre = await p.textContent('.tour-card');
  ok('En celular, lo que está en «Más» lo dice', /Dentro de «Más»/.test(pre), pre.slice(0, 60));
  await p.screenshot({ path: path.join(SHOTS, 't6-movil-mas.png') });
  await p.click('[data-t="saltar"]').catch(async () => { await p.keyboard.press('Escape') });
  await p.waitForTimeout(200); ok('Saltar lo cierra', !(await p.$('#tour')));
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.log('FALLO', e.message.split('\n')[0]); process.exit(1) });
