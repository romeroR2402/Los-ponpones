# Tienda de Serigrafía

Tienda en línea para vender **playeras, sudaderas, suéteres, pantalones y bolsas** estampadas.
El cliente paga por **transferencia bancaria**, sube la **foto de su comprobante** y este se guarda
en tu panel y en tu **carpeta de Google Drive**.

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La tienda que ven tus clientes (inicio, categorías, producto, carrito, pago, mis pedidos). |
| `admin.html` | Tu panel: publicar productos con fotos, revisar comprobantes, cambiar estado de pedidos, datos bancarios. |
| `config.js` | Conexión a Supabase y a Google Drive. |
| `supabase/tienda.sql` | Crea tablas, seguridad y carpetas de fotos en Supabase. |
| `google-drive/Code.gs` | Script que guarda los comprobantes en tu Drive. |

## Puesta en marcha (una sola vez)

### 1. Base de datos (Supabase)
1. Entra a tu proyecto en supabase.com → **SQL Editor** → *New query*.
2. Abre `supabase/tienda.sql`, cambia el correo `dueno@ponpones.com` por el tuyo (línea 11) y pega todo → **Run**.
3. En **Authentication → Users** crea tu usuario con ese mismo correo y una contraseña.

> Mientras no hagas este paso, la tienda funciona en **modo demo** (aviso amarillo arriba).

### 2. Google Drive (comprobantes)
Los comprobantes se guardan en tu carpeta
<https://drive.google.com/drive/folders/1KLOxs7x5rRl3MBd27P6ITB9unietu9P3>, con una subcarpeta por mes.

1. Ve a <https://script.google.com> → **Nuevo proyecto** y pega `google-drive/Code.gs`.
2. Cambia `CLAVE` por una palabra secreta tuya.
3. **Implementar → Nueva implementación → Aplicación web**. *Ejecutar como:* Yo. *Acceso:* Cualquier usuario.
4. Autoriza y copia la URL que termina en `/exec`.
5. En `config.js` pega esa URL en `driveUrl` y tu palabra secreta en `driveClave`.

### 3. Tus datos bancarios
Abre `admin.html` → entra → **Datos bancarios**: banco, titular, CLABE, WhatsApp y costo de envío.

## Uso diario
- **Publicar producto:** `admin.html` → Productos → *Publicar producto nuevo* → fotos desde el celular, precio, tallas, colores → Publicar.
- **Revisar pagos:** pestaña Pedidos → *Ver comprobante* (o *Abrir en Drive*) → cambia el estado a **pagado**, luego **enviado** y **entregado**.
- El cliente ve el avance en *Pedidos* con su folio y teléfono.

## Publicar con su propio enlace
Esta tienda vive en la rama `tienda-serigrafia`, separada de Los Ponpones (`main`).
La forma más fácil de tener un link propio:
- **Netlify** o **Vercel** → *Import from GitHub* → repositorio `Los-ponpones` → rama **`tienda-serigrafia`** → Deploy.
  Te da un link tipo `https://tu-tienda.netlify.app` (no hace falta compilar nada).
