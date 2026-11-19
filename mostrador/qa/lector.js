// QA de la pistola lectora: ráfagas tipo teclado (HID) en cada pantalla y una pistola BLE simulada.
// Uso: SUPABASE_JS=/ruta/supabase.js QA_EMAIL=... QA_PASS=... node mostrador/qa/lector.js  (usuario sin negocio)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS || require.resolve('@supabase/supabase-js/dist/umd/supabase.js'));
const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
const pistola = async (p, code) => { await p.keyboard.type(code, { delay: 8 }); await p.keyboard.press('Enter'); await p.waitForTimeout(400) };
const MOCK_BLE = () => {
  const listeners = []; const ch = { properties: { notify: true }, startNotifications: async () => ch, addEventListener: (t, f) => listeners.push(f) };
  const dev = { id: 'pistola-1', name: 'NETUM C750', addEventListener: () => {},
    gatt: { connected: false, connect: async () => { dev.gatt.connected = true; return { getPrimaryServices: async () => [{ getCharacteristics: async () => [ch] }] } }, disconnect: () => { dev.gatt.connected = false } } };
  window.__dispararBLE = (txt) => { const v = new TextEncoder().encode(txt); listeners.forEach(f => f({ target: { value: new DataView(v.buffer) } })) };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => dev, getDevices: async () => [] } });
};
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(MOCK_BLE);
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); global.P = p; p.on('pageerror', e => log.push('PAGEERROR ' + e.message));
  await p.goto(BASE); await p.waitForSelector('#fa');
  await p.fill('[name=email]', process.env.QA_EMAIL || 'qa-abarrotes@usuarios.mostrador.app'); await p.fill('[name=pass]', process.env.QA_PASS || 'PruebaQA-2026'); await p.click('#fa button.btn');
  await p.waitForSelector('.giro'); await p.click('.giro:has-text("Tienda de abarrotes")'); await p.fill('[name=nombre]', 'Abarrotes Pistola'); await p.click('button:has-text("Continuar")');
  await p.click('#crear'); await p.waitForSelector('.done'); await p.click('button:has-text("Después")'); await p.waitForSelector('.kpis');

  await p.goto(BASE + '#/productos'); await p.waitForSelector('#p-lista'); await p.click('h1');
  await pistola(p, '7501055300075'); await p.waitForSelector('#ar');
  ok('Pistola en Productos → tarjeta del catálogo', (await p.textContent('.sheet')).includes('Coca-Cola'));
  await p.waitForTimeout(200); await pistola(p, '0049505090703');
  ok('Disparo con tarjeta abierta no ensucia el precio', (await p.inputValue('#ar [name=precio]')) === '', await p.inputValue('#ar [name=precio]'));
  ok('…y avisa que termine primero', /Termina o cierra/.test(await p.textContent('.toast')));
  await p.fill('#ar [name=precio]', '18'); await p.fill('#ar [name=existencia]', '10'); await p.click('#ar-ok'); await p.waitForSelector('#sheet', { state: 'detached' });
  await p.click('h1'); await pistola(p, '7501055300075'); await p.waitForSelector('#dp-mov');
  ok('Producto existente → abre su detalle', (await p.textContent('.sheet h2')).includes('Coca-Cola')); await p.click('.sheet-x');

  await p.goto(BASE + '#/vender'); await p.waitForSelector('#v-q'); await p.focus('#v-q');
  await pistola(p, '7501055300075');
  ok('Vender: con cursor en el buscador agrega a la venta', (await p.textContent('#v-ver')).includes('$18.00'));
  ok('…y el buscador queda limpio', (await p.inputValue('#v-q')) === '');
  await p.evaluate(() => document.activeElement.blur()); await pistola(p, '7501055300075');
  ok('Vender: sin cursor también agrega (2 pzas)', (await p.textContent('#v-ver')).includes('$36.00'), await p.textContent('#v-ver'));
  await p.click('#v-ver'); await p.waitForSelector('#sheet [data-cobrar]'); await pistola(p, '7501055300075');
  ok('Con el carrito abierto sigue sumando (3 pzas)', (await p.textContent('#sheet [data-cobrar]')).includes('$54.00'));
  await p.click('.sheet-x');
  await p.click('#v-q'); await p.keyboard.type('coca', { delay: 160 }); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok('Escribir a mano (lento) no se confunde con la pistola', (await p.textContent('#v-ver')).includes('$72.00'), await p.textContent('#v-ver'));

  await p.goto(BASE + '#/entradas'); await p.waitForSelector('#e-esc'); await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await pistola(p, '7501055300075'); await pistola(p, '7501055300075');
  ok('Entradas: cada disparo suma a la lista', (await p.inputValue('#e-lineas [data-i="0"] [data-k=cantidad]')) === '2');

  await p.goto(BASE + '#/lector'); await p.waitForSelector('#lp-prueba'); await shot(p, 'l1-lector');
  await pistola(p, '7501055300075');
  ok('Prueba del lector muestra el producto', (await p.textContent('#lp-prueba')).includes('Coca-Cola') && (await p.textContent('#lp-hid')).includes('Funcionando'));
  await p.click('#lp-ble'); await p.waitForSelector('text=NETUM C750');
  ok('BLE: se conecta y muestra el nombre del lector', true); await shot(p, 'l2-ble');
  await p.goto(BASE + '#/vender'); await p.waitForSelector('#v-q');
  await p.evaluate(() => window.__dispararBLE('7501055300075\r\n')); await p.waitForTimeout(400);
  ok('BLE: el código llega a Vender y se agrega', (await p.textContent('#v-ver')).includes('$90.00'), await p.textContent('#v-ver'));
  ok('Indicador verde del lector en la barra', await p.isVisible('#lec-dot'));
  await p.evaluate(() => window.__dispararBLE('75010553')); await p.evaluate(() => window.__dispararBLE('00075')); await p.waitForTimeout(500);
  ok('BLE: código partido en 2 paquetes se junta', (await p.textContent('#v-ver')).includes('$108.00'), await p.textContent('#v-ver'));
  await shot(p, 'l3-vender');
  await p.setViewportSize({ width: 1280, height: 800 }); await p.goto(BASE + '#/lector'); await p.waitForSelector('#lp-prueba'); await shot(p, 'l4-desk');
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.error('FALLO', e.message.split('\n')[0]); process.exit(1) });
