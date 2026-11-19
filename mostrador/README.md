# Mostrador · Sistema de gestión para comercios

Una sola app que se adapta al giro del negocio: **abarrotes, minisúper, tlapalería, farmacia, papelería** y otros.
Se instala como app en Android, iPhone, tablet o PC, y **la caja sigue vendiendo sin internet**.

**Link** (GitHub Pages, cuando se suba): https://romeror2402.github.io/Los-ponpones/mostrador/

## Qué hace
| Módulo | Para qué |
|---|---|
| **Registro del negocio** | Eliges tu giro (tarjetas con ícono) y contestas 6 preguntas sí/no (¿caduca?, ¿granel?, ¿fiado?…). El sistema prende sólo lo que usas. |
| **Inicio** | Lo que vendiste hoy, ganancia estimada, lo que se acaba y lo que se vence. |
| **Vender** | Busca, toca o **escanea** (cámara o lector USB). Granel por kilo **o por dinero** ("dame $45 de jamón"). Efectivo con cambio, tarjeta, transferencia o fiado. Ticket por WhatsApp. |
| **Productos** | Alta escaneando el código (busca el nombre en el catálogo abierto Open Food Facts), mínimos, costo y ganancia, caducidad. Campos extra según el giro (farmacia: sustancia activa, laboratorio, receta). |
| **Entrada de mercancía** | 3 formas: escanear uno tras otro, **subir el XML de la factura (CFDI 4.0)** que se llena sola con costos con IVA y crea al proveedor, o buscar a mano. Fecha de caducidad por lote y "el proveedor me lo cambia". |
| **Alertas** | Pídele el cambio al proveedor · Ya vencieron · Vencen pronto · Agotados · Se están acabando. Botones para sacar mermas, pedir el cambio por WhatsApp y **armar pedido** al proveedor. Aviso en el celular una vez al día. |
| **Ventas** | Hoy / 7 / 30 días, ticket promedio, lo más vendido, por forma de pago, cancelar venta (regresa existencias). |
| **Proveedores** | Con WhatsApp, RFC y día de visita. |
| **Mi negocio** | Datos, prender/apagar funciones, días de aviso de caducidad. |

## Cómo está hecho (igual que Los Ponpones y Velas)
- HTML + CSS + JavaScript sin compilar, instalable (manifest + service worker).
- Supabase (mismo proyecto que Los Ponpones), tablas con prefijo `mos_`. Estructura en `supabase/mostrador.sql` (ya aplicada).
- **Multi-negocio:** cada fila lleva `negocio_id` y la seguridad por fila (RLS) impide ver o tocar datos de otro negocio.
- **Giros = datos** (`js/giros.js`). Agregar un giro nuevo es agregar un objeto ahí; los módulos preguntan por *capacidades*, nunca por el giro.
- **Inventario = libro de movimientos** (entradas, ventas, mermas, correcciones). La existencia se actualiza sola.
- Las ventas tienen un id generado en el celular: si se mandan dos veces (por falta de internet) no se duplican.
- Al vender se descuenta primero el lote que caduca antes (FEFO).

## Antes de usarlo con tiendas reales (pendiente del dueño del proyecto)
1. **Abrir el registro de cuentas:** en Supabase el registro está desactivado (`Authentication → Sign In / Providers → Allow new users to sign up`).
   Mientras esté cerrado, la app muestra "Por ahora el registro está cerrado".
2. **Correos:** el correo gratuito de Supabase sólo manda unos pocos por hora. Para muchas tiendas configura un SMTP propio
   (Authentication → Emails → SMTP) o desactiva "Confirm email".
3. En **Authentication → URL Configuration → Redirect URLs** agrega `https://romeror2402.github.io/Los-ponpones/mostrador/**`.

## Pruebas
`qa/e2e.js` recorre 35 casos en dos giros (abarrotes y farmacia), móvil y escritorio, sin internet y aislamiento entre negocios.
Necesita dos usuarios de prueba confirmados (`qa-abarrotes@…`, `qa-farmacia@…`) y un servidor local:
`python3 -m http.server 8080` en la raíz del repositorio y luego `node mostrador/qa/e2e.js`.
Resultados y bugs: `docs/qa/`.

## Equipo de Skills (Claude)
`.claude/skills/`: **ux-ui-designer**, **react-developer** (aquí: frontend), **qa-tester** e **investigar-sistemas-tienda**.
Flujo obligatorio en `docs/FLUJO-DE-TRABAJO.md`; propuesta y arquitectura en `docs/propuesta-arquitectura.md`.
