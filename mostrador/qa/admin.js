// QA del panel de administración y del ciclo de acceso de una tienda.
// Requiere: superadmin qa-admin@usuarios.mostrador.app y tienda "Miscelánea Rosa QA" (dueña qa-tienda@…) con la prueba vencida.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const SB = fs.readFileSync(process.env.SUPABASE_JS); const RAIZ = path.join(__dirname, '..', '..'); const BASE = 'http://localhost:8081/mostrador/';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots'); const PASS = 'PruebaQA-2026';
const log = []; const ok = (n, c, d = '') => log.push((c ? '✅ ' : '❌ ') + n + (d ? ' — ' + d : ''));
async function ctxNuevo(b, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mostrador-sin-recorrido', '1') } catch (e) {} });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript' }));
  await ctx.route('http://localhost:8081/**', r => {
    let f = new (require('url').URL)(r.request().url()).pathname; if (f.endsWith('/')) f += 'index.html';
    const full = path.join(RAIZ, f); if (!fs.existsSync(full)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(full), contentType: { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(full)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); p.on('pageerror', e => log.push('PAGEERROR ' + e.message)); global.P = p; return p;
}
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png') });
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  // ===== Tienda con la prueba vencida =====
  const t = await ctxNuevo(b, { width: 390, height: 844 });
  await t.goto(BASE); await t.waitForSelector('#fa'); await t.fill('[name=email]', 'qa-tienda@usuarios.mostrador.app'); await t.fill('[name=pass]', PASS); await t.click('#fa button.btn');
  await t.waitForSelector('#fpago', { timeout: 30000 }); await t.waitForTimeout(300);
  ok('Tienda vencida ve "Tu prueba gratis terminó" con cómo pagar', (await t.textContent('.empty b')).includes('prueba gratis terminó'));
  ok('No entra a la app (no hay menú)', !(await t.$('.tabbar')));
  await shot(t, 'a1-tienda-vencida');
  await t.fill('#fpago [name=referencia]', 'SPEI 4455'); await t.click('#fpago button.btn'); await t.waitForSelector('.note.info', { timeout: 20000 });
  ok('Avisa que ya pagó', (await t.textContent('#pp-cont')).includes('Ya nos avisaste'));
  // ===== Administrador =====
  const a = await ctxNuevo(b, { width: 1280, height: 800 });
  await a.goto(BASE + 'admin.html'); await a.waitForSelector('#fa'); await shot(a, 'a2-admin-entrar');
  await a.fill('[name=email]', 'qa-admin@usuarios.mostrador.app'); await a.fill('[name=pass]', PASS); await a.click('#fa button');
  await a.waitForSelector('.adm-kpis'); await a.waitForTimeout(300); await shot(a, 'a3-resumen');
  const pend = await a.textContent('[data-tab="pagos"]'); ok('Resumen y pestaña Pagos con aviso pendiente', /1/.test(pend), pend.trim());
  await a.click('[data-tab="tiendas"]'); await a.waitForSelector('.tbl'); await a.waitForTimeout(200); await shot(a, 'a4-tiendas');
  const txt = await a.textContent('.tbl'); ok('Lista de tiendas con ubicación y acceso', txt.includes('Miscelánea Rosa QA') && txt.includes('Tlalpan') && txt.includes('Venció el'));
  await a.click('.chip[data-f="pagos"]'); ok('Filtro "Avisaron pago"', (await a.$$('.tbl tbody tr')).length === 1);
  await a.click('tr:has-text("Miscelánea Rosa QA")'); await a.waitForSelector('[data-conf]'); await a.waitForTimeout(300); await shot(a, 'a5-acceso');
  await a.click('[data-conf]'); await a.waitForSelector('.toast.ok >> text=Pago confirmado', { timeout: 20000 });
  await a.waitForSelector('.sheet p .pill >> text=Pagada', { timeout: 20000 }); const pl = await a.textContent('.sheet p .pill'); ok('Confirmar pago da acceso (Pagada)', /Pagada/.test(pl), pl);
  // La tienda vuelve a entrar
  await t.click('#pp-rev'); await t.waitForSelector('.kpis', { timeout: 30000 });
  ok('La tienda vuelve a entrar al confirmar el pago', true);
  // Quitar acceso
  await a.fill('#ac-motivo', 'Falta de pago QA'); await a.click('#ac-bloq'); await a.click('#cf-si'); await a.waitForSelector('#ac-desb', { timeout: 20000 });
  ok('Quitar acceso (bloqueada)', /bloqueada/.test(await a.textContent('.sheet p .pill')));
  await t.reload(); await t.waitForSelector('.empty b', { timeout: 30000 }); await t.waitForTimeout(300);
  ok('La tienda bloqueada ve "pausada" con el motivo', (await t.textContent('.empty')).includes('Falta de pago QA')); await shot(t, 'a6-tienda-bloqueada');
  await a.click('#ac-desb'); await a.waitForSelector('#ac-bloq', { timeout: 20000 }); ok('Devolver acceso', true);
  // Prueba gratis
  await a.fill('#ac-dias', '5'); await a.click('#ac-prueba'); await a.waitForSelector('.toast.ok >> text=Prueba de 5', { timeout: 20000 });
  // Desactivar usuario
  await a.click('[data-usr][data-act="0"]'); await a.waitForSelector('[data-usr][data-act="1"]', { timeout: 20000 });
  await t.reload(); await t.waitForSelector('.empty b', { timeout: 30000 });
  ok('Usuario desactivado ve "Tu acceso está desactivado" (no le pide crear otra tienda)', (await t.textContent('.empty b')).includes('desactivado'));
  await a.click('[data-usr][data-act="1"]'); await a.waitForSelector('[data-usr][data-act="0"]', { timeout: 20000 });
  await t.reload(); await t.waitForSelector('.kpis', { timeout: 30000 }); ok('Al reactivarlo vuelve a entrar', true);
  await t.waitForTimeout(400);
  ok('Con un mes pagado no sale aviso de vencimiento', !(await t.$('.demo-bar')));
  // Con 5 días o menos sí sale: simulamos que el pago vence en 5 días
  await t.evaluate(() => { var d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10); M.negocio.pagado_hasta = d; M.negocio.prueba_hasta = d; document.querySelector('#view') && window.dispatchEvent(new HashChangeEvent('hashchange')) });
  await t.evaluate(() => { location.hash = '#/ventas' }); await t.waitForTimeout(300);
  const aviso = await t.evaluate(() => { var x = document.createElement('div'); return M.plan().dias });
  ok('Faltando 5 días el plan lo detecta', aviso === 5, String(aviso));
  await shot(t, 'a7-tienda-aviso');
  await t.goto(BASE + '#/plan'); await t.waitForSelector('#fpago'); await t.waitForTimeout(300); await shot(t, 'a8-mi-plan'); ok('Mi plan muestra estado y pagos', (await t.textContent('#view')).includes('Tus pagos'));
  await a.click('.sheet-x');
  // Cobro
  await a.click('[data-tab="cobro"]'); await a.fill('[name=banco]', 'BBVA QA'); await a.fill('[name=clabe]', '012180001234567891'); await a.click('#fk button'); await a.waitForSelector('.toast.ok >> text=Guardado');
  ok('Guardar datos de cobro', true); await shot(a, 'a9-cobro');
  // Crear acceso
  await a.click('[data-tab="crear"]'); await a.fill('#fc [name=nombre]', 'Cliente QA'); await a.fill('#fc [name=email]', 'qa-cliente-nuevo'); await a.click('#fc button.btn.block');
  await a.waitForSelector('.cred', { timeout: 30000 }); ok('Crear acceso con contraseña (y mandar por WhatsApp)', (await a.textContent('.cred')).includes('qa-cliente-nuevo@usuarios.mostrador.app'));
  await shot(a, 'a10-crear');
  // Celular del admin
  await a.setViewportSize({ width: 390, height: 844 }); await a.click('[data-tab="tiendas"]'); await a.waitForTimeout(300); await shot(a, 'a11-admin-movil');
  // Sin permiso
  const n = await ctxNuevo(b, { width: 1280, height: 800 });
  await n.goto(BASE + 'admin.html'); await n.fill('[name=email]', 'qa-tienda@usuarios.mostrador.app'); await n.fill('[name=pass]', PASS); await n.click('#fa button');
  await n.waitForSelector('text=Sin permisos', { timeout: 20000 }); ok('Una tienda no puede entrar al panel', true);
  await b.close(); console.log(log.join('\n'));
})().catch(async e => { try { await global.P.screenshot({ path: path.join(SHOTS, 'fallo.png') }) } catch (x) {} console.log(log.join('\n')); console.log('FALLO', e.message.split('\n')[0]); process.exit(1) });
