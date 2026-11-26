# Mostrador · Sistema de gestión para comercios

Una sola app que se adapta al giro del negocio: **abarrotes, minisúper, tlapalería, farmacia, papelería** y otros.
Se instala como app en Android, iPhone, tablet o PC, y **la caja sigue vendiendo sin internet**.
Igual que Los Ponpones: en la entrada y en Inicio aparece el aviso **«Instala la app»** (en Android abre la ventana de instalar; en iPhone muestra los pasos Compartir → Agregar a inicio). La ✕ lo oculta y ya abierta como app no vuelve a salir. Prueba: `qa/instalar.js`.

**Link** (GitHub Pages, cuando se suba): https://romeror2402.github.io/Los-ponpones/mostrador/

## Qué hace
| Módulo | Para qué |
|---|---|
| **Registro del negocio** | Eliges tu giro (tarjetas con ícono) y contestas 6 preguntas sí/no (¿caduca?, ¿granel?, ¿fiado?…). El sistema prende sólo lo que usas. |
| **Inicio** | Lo que vendiste hoy, ganancia estimada, lo que se acaba y lo que se vence. |
| **Vender** | Busca, toca o **escanea** (cámara o lector USB). Granel por kilo **o por dinero** ("dame $45 de jamón"). Efectivo con cambio, tarjeta, transferencia o fiado. Ticket por WhatsApp. |
| **Productos** | Alta escaneando el código: **≈25 mil productos de México ya vienen cargados** (nombre, marca, presentación, foto y categoría) y sólo pones el precio. Si no está, lo escribes una vez y queda para todas las tiendas. También: mínimos, costo y ganancia, caducidad. Campos extra según el giro (farmacia: sustancia activa, laboratorio, receta). |
| **Entrada de mercancía** | 4 formas: escanear uno tras otro, **subir el XML de la factura (CFDI 4.0)** que se llena sola con costos con IVA y crea al proveedor, **foto del ticket del proveedor** (Coca, Pepsi, Bimbo…: se lee en el celular con Tesseract, igual que en Los Ponpones; empareja cada renglón con tu producto, cantidad y costo, y lo que no tienes lo da de alta), o buscar a mano. Fecha de caducidad por lote y "el proveedor me lo cambia". |
| **Alertas** | Pídele el cambio al proveedor · Ya vencieron · Vencen pronto · Agotados · Se están acabando. Botones para sacar mermas, pedir el cambio por WhatsApp y **armar pedido** al proveedor. Aviso en el celular una vez al día. |
| **Ventas** | Hoy / 7 / 30 días, ticket promedio, lo más vendido, por forma de pago, cancelar venta (regresa existencias). |
| **Lector de códigos** | Pistolas **Bluetooth en modo teclado (HID)** —Android, iPhone y PC— y **USB**: se detecta la ráfaga del lector en cualquier pantalla, sin tocar nada. Pistolas **BLE** con botón “Conectar lector” (Chrome Android/PC). Pantalla de prueba con instrucciones. En Vender agrega a la venta, en Entradas suma a la lista, en otras pantallas muestra el producto o lo da de alta desde el catálogo. |
| **Proveedores** | Con WhatsApp, RFC y día de visita. |
| **Mi negocio** | Datos, prender/apagar funciones, días de aviso de caducidad. |

## Registro con verificación de correo
“Crear cuenta” usa la función `mos-registro` (el registro general de Supabase está cerrado para proteger las otras tiendas del proyecto).
Con correo configurado, al registrarse llega un **código de 6 números** y la cuenta no entra hasta escribirlo
(15 minutos de vigencia, 5 intentos, reenvío cada minuto, máximo 5 registros por hora por lugar).

**Para activar el envío de códigos (Gmail):**
1. En tu cuenta de Google activa la verificación en 2 pasos y crea una **contraseña de aplicación** (myaccount.google.com/apppasswords).
2. En Supabase → Edge Functions → **Secrets** agrega `SMTP_USER` = tu Gmail y `SMTP_PASS` = la contraseña de aplicación (16 letras).
Mientras no estén, las cuentas se crean ya activadas (sin código).

## Operaciones en lote
- **Alertas → caducidades:** casillas para elegir varios lotes (o “Seleccionar todos”) y una barra con
  **Sacar** (merma de todos), **Me los cambió** (el proveedor cambió lo vencido por nuevo: sale lo viejo y entra lo nuevo con su nueva fecha;
  una fecha para todos o una por producto, y cuántos te dio) y **Pedir cambio** (un solo WhatsApp por proveedor con la lista).
- **Productos → Seleccionar:** elegir varios (o todos los de la lista filtrada) y **Cambiar en lote**: precio fijo o subir/bajar %,
  costo, mínimo, categoría, si caducan; o **Quitar** del catálogo.
- **Productos → Agregar varios:** escanear uno tras otro (cámara, pistola o tecleando), los del catálogo salen con nombre;
  se llenan precio, costo, cuántos hay, caducidad y categoría en una lista y se guardan todos juntos (con su entrada de inventario).
- También en lote: factura XML y foto del ticket (entrada de mercancía). SQL: `supabase/lotes.sql`. Prueba: `qa/lotes.js` (12 casos).

## Administración de la plataforma (sólo tú)
**https://romeror2402.github.io/Los-ponpones/mostrador/admin.html** (o “Administración” en el menú de la app, sólo visible para ti).
Igual que el panel de psicoagenda:
- **Resumen:** tiendas, con acceso (en prueba / pagando), por vencer, sin acceso, cobrado del mes, ingreso mensual estimado, pagos por confirmar, renovaciones y tiendas por estado.
- **Tiendas:** buscador y filtros; cada tienda con dueño, ubicación, estado de acceso, productos, ventas de 30 días y último acceso. Botón **Acceso**:
  confirmar/rechazar pagos que avisó, **registrar un pago y dar acceso** (1, 3, 6 o 12 meses; se suma desde su vencimiento), **dar días de prueba**,
  **quitar / devolver acceso** con motivo, precio especial, **quién puede entrar** (activar/desactivar usuarios, cambiar contraseña), notas e historial de pagos.
- **Pagos:** por confirmar e historial. **Crear acceso:** cuenta con contraseña para un cliente y mandarla por WhatsApp. **Cobro y prueba:** precio, días de prueba, banco, CLABE, WhatsApp.

Del lado de la tienda: prueba de 30 días; 7 días antes aparece “Tu prueba termina en X días · Ver cómo pagar”; al vencer o si la bloqueas
ve “Tu prueba gratis terminó / Tu tienda está pausada” con tus datos de pago y **“Avisar que ya pagué”**; cuando confirmas, vuelve a entrar.
**Mi plan** (dueños) muestra hasta cuándo tiene acceso y sus pagos. El bloqueo es real: lo aplica la base de datos, no sólo la pantalla.
Prueba: `qa/admin.js` (19 casos).

## Recorrido para usuarios nuevos
La primera vez que alguien entra, la app ilumina cada sección del menú y explica para qué sirve (se adapta a celular/computadora
y a las funciones de su giro). Al crear su tienda arranca solo y termina con “Agregar productos”. Se repite desde **“Cómo funciona”**
(menú lateral o “Más”). Prueba: `qa/recorrido.js`.

## Demo para mostrar a clientes
En la pantalla de entrada: **“Ver la demo: tienda de ejemplo”** (Abarrotes La Esperanza, Coyoacán): 53 productos con foto,
5 proveedores, ~750 ventas de los últimos 30 días, caducidades (una por cambiar con el proveedor, una vencida, varias por vencer),
agotados y productos por acabarse. Se puede vender y mover todo; el botón **“Reiniciar demo”** la deja como nueva. Si al entrar sus ventas no son de hoy, se renueva sola.
Cuenta: `demo@usuarios.mostrador.app` / `demo2026` (pública; sólo ve su tienda). SQL en `supabase/demo.sql`.

## Diseño
Estilo **"Mostrador Verde"** tomado de la referencia del cliente (punto de venta verde): menú lateral blanco con íconos de línea,
mosaicos de categorías, tarjetas de producto con foto y botón "+ Agregar", panel de la venta a la derecha.
Reglas en `.claude/skills/ux-ui-designer/references/design-system.md`. Íconos: Lucide (ISC) en `js/iconos.js`, sin internet.

## Cómo está hecho (igual que Los Ponpones y Velas)
- HTML + CSS + JavaScript sin compilar, instalable (manifest + service worker).
- Supabase (mismo proyecto que Los Ponpones), tablas con prefijo `mos_`. Estructura en `supabase/mostrador.sql` (ya aplicada).
- **Multi-negocio:** cada fila lleva `negocio_id` y la seguridad por fila (RLS) impide ver o tocar datos de otro negocio.
- **Giros = datos** (`js/giros.js`). Agregar un giro nuevo es agregar un objeto ahí; los módulos preguntan por *capacidades*, nunca por el giro.
- **Inventario = libro de movimientos** (entradas, ventas, mermas, correcciones). La existencia se actualiza sola.
- Las ventas tienen un id generado en el celular: si se mandan dos veces (por falta de internet) no se duplican.
- Al vender se descuenta primero el lote que caduca antes (FEFO).

## Catálogo de productos
Tabla `mos_catalogo` con datos de [Open Food Facts](https://world.openfoodfacts.org) (ODbL) + lo que aportan las tiendas (nunca el precio).
Cómo actualizarlo: `supabase/catalogo/README.md`.

## Antes de usarlo con tiendas reales (pendiente del dueño del proyecto)
1. **Abrir el registro de cuentas:** en Supabase el registro está desactivado (`Authentication → Sign In / Providers → Allow new users to sign up`).
   Mientras esté cerrado, la app muestra "Por ahora el registro está cerrado".
2. **Correos:** el correo gratuito de Supabase sólo manda unos pocos por hora. Para muchas tiendas configura un SMTP propio
   (Authentication → Emails → SMTP) o desactiva "Confirm email".
3. En **Authentication → URL Configuration → Redirect URLs** agrega `https://romeror2402.github.io/Los-ponpones/mostrador/**`.

## Pruebas
`qa/ticket.js`: lee de verdad la imagen de un ticket de Coca-Cola (8 casos: renglones, cantidades, costos, emparejar, nuevos, TOTAL, proveedor, inventario).
`qa/demo.js`: 11 casos de la demo (entrar con un toque, datos llenos, vender, reiniciar, aislamiento).
`qa/lector.js`: 15 casos de pistola (ráfagas tipo teclado en cada pantalla, escritura lenta que no se confunde, pistola BLE simulada).
`qa/e2e.js` recorre 35 casos en dos giros (abarrotes y farmacia), móvil y escritorio, sin internet y aislamiento entre negocios.
Necesita dos usuarios de prueba confirmados (`qa-abarrotes@…`, `qa-farmacia@…`) y un servidor local:
`python3 -m http.server 8080` en la raíz del repositorio y luego `node mostrador/qa/e2e.js`.
Resultados y bugs: `docs/qa/`.

## Equipo de Skills (Claude)
`.claude/skills/`: **ux-ui-designer**, **react-developer** (aquí: frontend), **qa-tester** e **investigar-sistemas-tienda**.
Flujo obligatorio en `docs/FLUJO-DE-TRABAJO.md`; propuesta y arquitectura en `docs/propuesta-arquitectura.md`.
