# Design System — "Mostrador Verde" (v2, 19 nov 2026)

Fuente de verdad del estilo de TODA la app. Inspirado en la referencia del cliente
(`referencias-visuales.md` → Referencia 5: punto de venta verde): **verde amigable, tarjetas blancas,
fotos grandes, íconos de línea y la cuenta siempre a la vista**. Reemplaza al sistema azul v1.

Implementado en `css/mostrador.css` (variables en `:root`) e íconos en `js/iconos.js` (`ic('nombre', tamaño)`).

## 1. Personalidad
- **Amigable y tranquilo:** mucho blanco, verde suave, esquinas redondeadas, sombras casi invisibles.
- **Visual antes que texto:** cada categoría y módulo tiene ícono; cada producto, foto (o su ícono de categoría).
- **Una acción principal por pantalla**, siempre verde y grande (Vender, Cobrar, Guardar).

## 2. Color
| Token | Valor | Uso |
|---|---|---|
| `--primary` | `#1f9a55` | Botón principal, elemento activo, íconos activos, precio destacado |
| `--primary-h` | `#17804a` | Hover / presionado |
| `--primary-soft` | `#eaf6ef` | Fondo de activo (menú, mosaico, chip), botón secundario |
| `--primary-line` | `#bfe3cc` | Borde de seleccionado suave |
| `--canvas` | `#f5f7f6` | Fondo de página (gris verdoso muy claro) |
| `--surface` | `#ffffff` | Tarjetas, menú lateral, panel de la venta |
| `--surface-2` | `#f2f4f3` | Buscador, campos, hover de filas |
| `--text` | `#1c2420` | Títulos y texto principal |
| `--body` | `#56605b` | Texto de cuerpo |
| `--muted` | `#8a938e` | Ayudas, etiquetas, metadatos |
| `--line` | `#e6eae8` | Bordes y divisores |
| `--warn` / `--warn-soft` | `#c27a00` / `#fff5e0` | Se acaba, vence pronto |
| `--bad` / `--bad-soft` | `#e0483e` / `#fdecea` | Agotado, vencido, descuento, error |
| `--info` / `--info-soft` | `#2f6fdb` / `#eaf1fd` | Avisos neutros |
| `--dark` | `#13201a` | Texto sobre fondos claros fuertes, avisos (toast) |

Reglas: el verde es **acción o activo**; el rojo es **problema o descuento**; el amarillo es **atención**.
Nunca más de un botón verde lleno por zona. Estado = color + ícono + texto.

## 3. Tipografía (Inter)
| Rol | Tamaño / peso |
|---|---|
| Total de la venta, KPI | 28–34 / 800, tracking -0.02em |
| Título de pantalla | 22–24 / 700 |
| Título de tarjeta / sección | 17–18 / 700 |
| Nombre de producto en tarjeta | 14 / 600, centrado, 2 líneas máx. |
| Precio en tarjeta | 15 / 700 |
| Texto base / inputs | 15–16 / 400–500 |
| Etiquetas, metadatos | 12–13 / 500 |

## 4. Forma, espacio y sombra
- Radios: tarjetas y paneles **16px**; mosaicos **14px**; botones y campos **10–12px**; chips y buscador **full**.
- Espaciado base 4px; separación entre tarjetas 12–16px; padding de tarjeta 12–16px.
- Bordes 1px `--line` + sombra mínima `0 1px 2px rgba(16,24,20,.04)`. Nada de sombras pesadas.
- Botones: alto 44px (40 en tarjetas de producto, 56 en Cobrar).

## 5. Estructura
- **Escritorio (≥ 900px):** menú lateral blanco 240px (logo + nombre del negocio arriba, módulos con ícono, Salir abajo) ·
  barra superior con buscador en píldora, lector, campana y avatar "Hola, Nombre" · contenido · en Vender, **panel de la venta a la derecha** (380px).
- **Celular:** barra superior compacta (logo, lector, campana, avatar) · barra inferior con 5 íconos · en Vender la venta se abre
  desde una barra verde fija "N productos · Cobrar $X".

## 6. Componentes
| Componente | Anatomía | Notas |
|---|---|---|
| **Ítem de menú** | ícono 20 + texto 15/500 | Activo: fondo `--primary-soft`, texto e ícono verdes, 600 |
| **Buscador** | píldora `--surface-2`, ícono lupa, botón de escáner a la derecha | 48px de alto |
| **Mosaico de categoría** | cuadro 92×92 blanco, ícono de línea 28 + nombre 13/600 | Activo: borde 2px verde, fondo `--primary-soft`, ícono verde. Primero siempre "Todos" (`layout-grid`) |
| **Tarjeta de producto** | foto 1:1 (o ícono de categoría sobre fondo suave) · nombre centrado · precio · botón verde "+ Agregar" de ancho completo | Insignia de existencia arriba a la izquierda si se acaba/agotado |
| **Panel de venta** | encabezado (Venta actual + nº) · renglones numerados (círculo), nombre, −/+, importe, basura · "Agregar nota" · Resumen (artículos, subtotal) · **Total** grande · botones: secundario suave + **Cobrar** verde | Siempre visible en escritorio |
| **Tarjeta KPI** | etiqueta 13 muted, número 28/800, pie 12 | Principal (Vendiste hoy) en verde lleno con texto blanco |
| **Fila de lista** | miniatura 44 (foto o ícono) · título 600 · subtítulo muted · valor/insignia a la derecha | |
| **Insignia** | píldora 12/600 | ok (verde), warn, bad, info, neutra |
| **Chip** | píldora borde `--line`; activo verde suave con texto verde | |
| **Botón** | primario verde lleno · secundario verde suave · fantasma con borde · peligro rojo | |
| **Hoja / ventana** | blanca, radio 20 (16 en escritorio), botón cerrar circular gris | |
| **Avatar** | círculo 36 verde suave con iniciales verdes | |

## 7. Íconos (Lucide, de línea, trazo 1.75)
Módulos: inicio `house` · vender `receipt` · productos `package` · entradas `truck` · alertas `bell` · ventas `trending-up` ·
proveedores `handshake` · lector `scan-barcode` · mi negocio `settings` · salir `log-out`.
Categorías: ver `ICONO_CATEGORIA` en `js/app.js` (bebidas `cup-soda`, lácteos `milk`, pan `croissant`, botanas `popcorn`,
dulces `candy`, galletas `cookie`, salchichonería `ham`, abarrotes `shopping-basket`, limpieza `spray-can`, higiene `bath`,
herramientas `hammer`, medicinas `pill`, papelería `pencil`…). Categoría sin ícono → `tag`.
Giros: abarrotes `shopping-basket`, minisúper `store`, tlapalería `hammer`, farmacia `pill`, papelería `pencil`, otro `store`.
**No usar emojis como íconos de interfaz** (sí en mensajes de WhatsApp).
