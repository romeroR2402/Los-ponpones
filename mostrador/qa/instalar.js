// QA del aviso "Instala la app" (como Los Ponpones): Android/Chrome con beforeinstallprompt, iPhone con instrucciones, y app ya instalada.
const { chromium, devices } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS); const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
async function ctxDe(b, opts, init) {
  const ctx = await b.newContext(Object.assign({ locale: 'es-MX', timezoneId: 'America/Mexico_City' }, opts));
  await ctx.addInitScript(() => { try { localStorage.setItem('mostrador-sin-recorrido', '1') } catch (e) {} });
  if (init) await ctx.addInitScript(init);
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new URL(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => log.push('PAGEERROR ' + e.message)); return p;
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  // 1) Android: el navegador ofrece instalar
  let p = await ctxDe(b, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(BASE); await p.waitForSelector('#ver-demo');
  ok('Sin oferta del navegador no se muestra el aviso', !(await p.$('.inst')));
  await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompt = 1 }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) });
  await p.waitForSelector('.inst'); ok('Aviso "Instala la app" en la pantalla de entrada', (await p.textContent('.inst')).includes('Instala la app'));
  await p.screenshot({ path: path.join(SHOTS, 'inst1-acceso.png') });
  await p.click('#ver-demo'); await p.waitForSelector('.kpis', { timeout: 30000 });
  ok('Aviso también en Inicio', !!(await p.$('.inst')));
  ok('Botón "Instalar" en el menú lateral/ajustes visible', await p.evaluate(() => document.documentElement.classList.contains('can-install')));
  await p.screenshot({ path: path.join(SHOTS, 'inst2-inicio.png') });
  await p.click('.inst [data-inst-si]'); await p.waitForTimeout(200);
  ok('"Instalar" abre la ventana del navegador', await p.evaluate(() => window.__prompt === 1));
  ok('Después de instalar se quita el aviso', !(await p.$('.inst')));
  await p.context().close();
  // 2) iPhone: instrucciones paso a paso; la ✕ lo oculta para siempre
  p = await ctxDe(b, devices['iPhone 13']);
  await p.goto(BASE); await p.waitForSelector('.inst');
  ok('iPhone: aviso sin esperar al navegador', true);
  await p.click('.inst [data-inst-si]'); await p.waitForSelector('.sheet .inst-pasos');
  ok('iPhone: pasos Compartir → Agregar a inicio', /Compartir[\s\S]*Agregar a inicio/.test(await p.textContent('.sheet')));
  await p.screenshot({ path: path.join(SHOTS, 'inst3-iphone.png') });
  await p.click('.sheet [data-cerrar] >> nth=1'); await p.click('.inst [data-inst-no]');
  ok('✕ oculta el aviso', !(await p.$('.inst')));
  await p.reload(); await p.waitForSelector('#ver-demo'); ok('Sigue oculto al volver a abrir', !(await p.$('.inst')));
  await p.context().close();
  // 3) Ya abierta como app: nunca sale
  p = await ctxDe(b, devices['iPhone 13'], () => { Object.defineProperty(navigator, 'standalone', { get: () => true }) });
  await p.goto(BASE); await p.waitForSelector('#ver-demo'); ok('Abierta como app: sin aviso', !(await p.$('.inst')));
  await p.context().close();
  // Manifest
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest')));
  ok('Manifest instalable (standalone, start_url ./, íconos 192/512/maskable)', m.display === 'standalone' && m.start_url === './' && m.icons.length >= 3);
  await b.close(); console.log(log.join('\n'));
})().catch(e => { console.log(log.join('\n')); console.log('FALLO', e.message.split('\n')[0]); process.exit(1) });
