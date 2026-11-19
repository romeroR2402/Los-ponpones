# Design System — "Mostrador" (nombre de trabajo)

Basado en los tokens que compartió el cliente (estética cálida, casi monocroma, un solo
color de acción), **renombrados y adaptados**: no usamos nombres, marca ni la fuente
propietaria de otra empresa. Fuente: **Inter** (libre) en lugar de "NotionInter";
sin serif editorial en la app (sólo en marketing, si acaso).

Se implementan como variables CSS en `src/design-system/tokens.css`.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#0075de` | Botón principal, enlace activo, foco. Único color de acción. |
| `--color-primary-hover` | `#005fb8` | Hover/presionado del primario |
| `--color-primary-soft` | `#e6f3fe` | Botón secundario, fila seleccionada |
| `--color-canvas` | `#f6f5f4` | Fondo de página (cálido) |
| `--color-surface` | `#ffffff` | Tarjetas, paneles, tablas |
| `--color-text` | `#111111` | Texto principal |
| `--color-text-body` | `#615d59` | Texto de cuerpo cálido |
| `--color-text-muted` | `#757575` | Ayudas, etiquetas, deshabilitado |
| `--color-border` | `rgba(0,0,0,0.10)` | Bordes y divisores |
| `--color-accent` | `#ffb110` | Destacados, insignias "Nuevo", onboarding |
| `--color-dark` | `#02093a` | Paneles oscuros puntuales |

### Colores semánticos (añadidos: los tokens originales no tenían estados)
Cada estado lleva **color + ícono + texto**, nunca sólo color.

| Token | Valor | Significado en el negocio |
|---|---|---|
| `--color-success` / `-soft` | `#1a7f4b` / `#e6f4ec` | En existencia, venta completada |
| `--color-warning` / `-soft` | `#b36b00` / `#fff4dc` | Stock bajo, vence en ≤ 14 días |
| `--color-danger` / `-soft` | `#c4321c` / `#fdeae6` | Agotado, vencido, error |
| `--color-info` / `-soft` | `#0075de` / `#e6f3fe` | Avisos neutros |

> `#ffb110` y `#f64932` del set original no pasan contraste AA como texto sobre blanco;
> se usan sólo como fondo/decoración.

## Tipografía (Inter)
| Token | Tamaño / peso / interlineado | Uso |
|---|---|---|
| `xs` | 12 / 500 / 1.33 | Insignias, metadatos |
| `sm` | 14 / 400–600 / 1.43 | Tablas, ayudas, etiquetas |
| `base` | 16 / 400–700 / 1.5 | Texto base (mínimo en móvil para inputs) |
| `xl` | 20 / 600 / 1.4 | Título de tarjeta / sección |
| `2xl` | 24 / 700 / 1.3 | Título de pantalla |
| `display` | 32–42 / 700 / 1.14, tracking -0.03em | Totales grandes (caja), KPIs |

## Espaciado, radios, sombras
- Unidad 4px: 4, 8, 12, 16, 20, 24, 32, 64.
- Radios: `sm 4px` (inputs), `md 8px` (botones), `lg 12px` (tarjetas), `full` (pills, chips).
- Sombra única de tarjeta: `0 1px 2px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)`.

## Componentes base (inventario inicial)
Botón (primario/secundario/fantasma/peligro; tamaños md 44px, lg 56px para caja) ·
Input / Select / NumberStepper (+/−, como en las referencias) · CantidadConUnidad
(número + unidad: pza, kg, m, caja) · Buscador con escáner · Chip de filtro ·
Badge de estado · Tarjeta de producto · Tarjeta KPI · Tabla de datos (con vista
tarjeta en móvil) · Lista con avatar/imagen · Toggle · Toast · Modal/Hoja inferior ·
EmptyState · Stepper de onboarding · Barra de navegación inferior (móvil) /
barra lateral (escritorio) · Alerta de caducidad / stock.

Nuevos componentes sólo bajo las reglas del SKILL.md.
