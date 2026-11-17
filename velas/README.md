# Tienda de Velas

Tienda en línea de velas, autoadministrable, instalable como app en Android y iPhone.

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientes | Inicio, colecciones, catálogo con buscador, favoritos, producto con aromas y reseñas, bolsa, pago por transferencia, subir comprobante, cuenta y mis pedidos |
| `admin.html` | Administrador | Pedidos (con avisos al instante), productos con fotos, clientes, reseñas y **Mi tienda**: nombre, logo, cuenta bancaria, WhatsApp y envío |

**Links** (GitHub Pages):
- Tienda: https://romeror2402.github.io/Los-ponpones/velas/
- Panel: https://romeror2402.github.io/Los-ponpones/velas/admin.html

## Cómo compra un cliente
1. Agrega velas a la bolsa y toca **Ir a pagar**.
2. Escribe nombre, WhatsApp y dirección (puede comprar con o sin cuenta).
3. Ve la cuenta bancaria de la tienda con botones para copiar CLABE, monto y folio.
4. Sube la foto de su comprobante y el pedido pasa a **Pago en revisión**.
5. Con el botón verde avisa a la tienda por **WhatsApp** con el pedido ya escrito.
6. En **Mi cuenta → Mis pedidos** sigue el avance: Esperando pago → En revisión → Pagado → En camino → Entregado.
7. Cuando el pedido está pagado puede dejar su **reseña** del producto.

## Cómo lo atiende el administrador
- El panel avisa con sonido, vibración y notificación cuando llega un pedido, un comprobante o una reseña (toca 🔔 la primera vez para permitir avisos).
- En cada pedido: ver comprobante, cambiar estado y mandar WhatsApp al cliente con el mensaje ya escrito según el estado.
- **Clientes**: quienes crearon cuenta y quienes compraron sin cuenta, con número de pedidos y total gastado.

## Base de datos
Usa el mismo proyecto de Supabase que Los Ponpones (el plan gratis permite 2 proyectos), con tablas separadas:
`velas_ajustes`, `velas_productos`, `velas_clientes`, `velas_pedidos`, `velas_resenas`, `velas_admins`,
y las carpetas de fotos `velas-fotos` (pública) y `velas-comprobantes` (privada, solo la ve el administrador).
La estructura completa está en `supabase/velas.sql` (ya aplicada).

Para agregar otra persona administradora: Supabase → SQL Editor →
`insert into velas_admins(email) values ('correo@ejemplo.com');` (con el correo en minúsculas)
y crea su usuario en Authentication → Users.

Para que los correos de confirmación de cuenta regresen a la tienda, en Supabase → Authentication → URL Configuration
agrega en **Redirect URLs**: `https://romeror2402.github.io/Los-ponpones/velas/**`

## WhatsApp
Los avisos por WhatsApp se envían con botones que abren WhatsApp con el mensaje ya escrito
(cliente → tienda y tienda → cliente). El envío automático sin tocar nada requiere la API de WhatsApp Business de Meta (de pago) y no está incluido.

## Fotos de los productos de ejemplo
Las fotos de `img/*.jpg` son de [Unsplash](https://unsplash.com) (licencia Unsplash: uso comercial gratis, sin atribución obligatoria).
Son fotos de referencia: cuando tengas fotos de tus propios productos, súbelas desde el panel → Productos.
Categorías iniciales: Velas en vaso, Velas decorativas, Kits, Aromatizantes y Regalos (puedes crear más escribiendo una nueva al editar un producto).
