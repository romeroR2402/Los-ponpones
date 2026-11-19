# Análisis de referencias visuales del cliente (18 nov 2026)

## 1. App móvil de supermercado (verde, muchas pantallas)
**Tomar:** cuadrícula de categorías con íconos grandes; tarjetas de producto con foto,
precio y botón "+"; filtros en hoja (chips de categoría, rango, ordenar); búsquedas
recientes; ticket electrónico con código de barras; pantalla de éxito con check grande y
una acción principal clara; notificaciones agrupadas por día.
→ Uso en la app: catálogo/venta rápida por categoría, filtros de inventario, ticket de venta,
confirmación de venta, centro de alertas (stock y caducidad).
**No tomar:** cupones y flujo de pago de e-commerce (no es nuestro caso).

## 2. Landing "FreshNest" (web)
**Tomar:** jerarquía hero → categorías → productos; tarjetas con stepper −/+; bloques
"Ver todo →".
→ Uso: dashboard de inicio ("Hoy": ventas, alertas, accesos directos) y venta en tablet.

## 3. Dashboard "All Product List"
**Tomar:** fila de KPIs arriba (activos, más vendido, vendidos, devueltos); filas de
producto con stock, precio y toggle de visibilidad; barra lateral con secciones y contadores.
→ Uso: módulo Productos/Inventario en escritorio. KPIs = "Productos", "Más vendido",
"Se están acabando", "Vencen pronto".
**Cuidado:** los medidores de "Performance" son decorativos; preferimos números claros.

## 4. Tabla "Shipido Products"
**Tomar:** buscador + filtros + chips de filtro activos removibles; badges de estado
("Activo", "Agotado"); exportar; paginación; checkbox para acciones masivas.
→ Uso: tabla de productos/ inventario/ compras en escritorio; en móvil se convierte en lista
de tarjetas.

## Síntesis
- Móvil (cajero): patrón de 1 (tarjetas, categorías, acción grande).
- Escritorio (dueño): patrón de 3 + 4 (KPIs + tabla con filtros).
- Las referencias usan verde; los tokens del cliente usan azul. **Decisión propuesta:** azul
  como color de acción y verde reservado para "en existencia / éxito", así no se confunde
  "acción" con "estado".

---
# Referencia 5 (19 nov 2026) — Punto de venta verde ⭐ ESTILO OFICIAL
Pantalla de caja de un restaurante: menú lateral blanco con íconos de línea, buscador en píldora, campana y avatar
"Bonjour, Amélie"; mosaicos de categorías con ícono (activo con borde verde); cuadrícula de productos con foto grande,
nombre centrado, precio y botón verde "+ Ajouter"; a la derecha "Commande en cours" con renglones numerados, nota,
resumen (subtotal, descuento en rojo, IVA) y total grande; botones "Enregistrer" (verde suave) y "Encaisser" (verde).

**El cliente pidió que TODO el sistema siga este estilo.** Lo tomamos completo, adaptado a tienda:
- "Commande en cours" → **Venta actual**; "Ajouter" → **Agregar**; "Encaisser" → **Cobrar**; "Enregistrer" → **Vaciar** / apartar.
- Sur place / À emporter / Livraison → formas de pago al cobrar (efectivo, tarjeta, transferencia, fiado).
- Fotos: las del catálogo (Open Food Facts); si no hay, ícono de la categoría sobre fondo suave.
Tokens y componentes: `design-system.md` v2.
