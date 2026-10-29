/**
 * Guarda los comprobantes de pago en TU Google Drive.
 *
 * Cómo instalarlo (5 minutos, una sola vez):
 *  1. Entra a https://script.google.com con tu cuenta de Google  →  "Nuevo proyecto".
 *  2. Borra lo que aparece y pega TODO este archivo.
 *  3. Cambia CLAVE por una palabra secreta tuya (la misma que pondrás en config.js → driveClave).
 *  4. Botón "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier usuario
 *  5. Autoriza los permisos y copia la URL que termina en /exec.
 *  6. Pégala en config.js → driveUrl.
 *
 * Los comprobantes se guardan en TU carpeta de Drive (CARPETA_ID), con una subcarpeta por mes:
 *   https://drive.google.com/drive/folders/1KLOxs7x5rRl3MBd27P6ITB9unietu9P3
 */
const CLAVE = 'cambia-esta-clave';
const CARPETA_ID = '1KLOxs7x5rRl3MBd27P6ITB9unietu9P3';
const MAX_MB = 8;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return json({ ok: false, error: 'clave' });
    if (TIPOS.indexOf(d.tipo) < 0) return json({ ok: false, error: 'tipo' });
    const bytes = Utilities.base64Decode(d.base64);
    if (bytes.length > MAX_MB * 1024 * 1024) return json({ ok: false, error: 'grande' });

    const raiz = DriveApp.getFolderById(CARPETA_ID);
    const mes = carpeta(raiz, Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM'));
    const nombre = limpiar(d.nombre || 'comprobante');
    const archivo = mes.createFile(Utilities.newBlob(bytes, d.tipo, nombre));
    archivo.setDescription('Cliente: ' + limpiar(d.cliente || '') + ' · Tel: ' + limpiar(d.telefono || '') +
                           ' · Total: $' + (d.total || ''));
    return json({ ok: true, url: archivo.getUrl(), id: archivo.getId() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, msg: 'Receptor de comprobantes activo' });
}

function carpeta(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function limpiar(s) {
  return String(s).replace(/[^\w\s.\-áéíóúñÁÉÍÓÚÑ]/g, '').slice(0, 80);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
