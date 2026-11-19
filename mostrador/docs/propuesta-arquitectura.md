# Propuesta: plataforma de gestión multi-giro para comercios
**Fecha:** 18 nov 2026 · **Estado:** Propuesto (pendiente de aprobación) · **Etapa:** análisis, sin código

---

## 1. Viabilidad

**Veredicto: viable, si se construye por etapas y empezando por un giro.**

| Factor | Evaluación |
|---|---|
| Mercado | Muy grande en México (tiendas de barrio, tlapalerías, farmacias independientes, papelerías). Cifras exactas: *por verificar* con INEGI / ANPEC. |
| Competencia | Existe (Eleventa, SICAR, Treinta, Loyverse, Alegra), pero casi todos son **un sistema para todo igual** o **uno por giro**. Pocos combinan configuración por giro + caducidades por lote + entrada de mercancía con XML de factura. |
| Técnica | Todas las piezas existen y están probadas: React PWA, Postgres con seguridad por fila, escaneo con cámara, IndexedDB offline. |
| Lo difícil | (1) offline con sincronización confiable, (2) aislamiento de datos entre negocios, (3) mantener 5 giros sin que el código se vuelva espagueti, (4) regulación de farmacia. Todo esto tiene solución, pero hay que diseñarla desde el día 1 (ver §7). |
| Alcance geográfico | **Diseñar para todo México, lanzar en CDMX.** No cuesta casi nada más: zona horaria por sucursal, estado/municipio en la dirección, impuestos por configuración. |

---

## 2. Arquitectura general

```
┌──────────────────────── Cliente (PWA React) ───────────────────────┐
│  Shell ── Registro de módulos ── Capacidades ── Permisos ── i18n   │
│     │                                                               │
│  Módulos: Ventas · Caja · Productos · Inventario · Compras ·        │
│           Proveedores · Clientes/Fiado · Alertas · Lotes/Caducidad  │
│     │                                                               │
│  Design System (tokens + componentes)                               │
│  Datos: TanStack Query  ⇄  IndexedDB (Dexie)  ⇄  Cola de sync       │
└───────────────────────────────┬────────────────────────────────────┘
                                │ HTTPS (JWT con tenant_id + rol)
┌───────────────────────────────▼────────────────────────────────────┐
│ Backend (propuesta: Supabase = Postgres + Auth + Storage + Edge Fn) │
│  • Row Level Security: toda tabla filtra por tenant_id              │
│  • Funciones: sync de movimientos, alertas diarias, lectura XML CFDI │
│  • Catálogo global de productos (código de barras) compartido       │
│  • Plantillas de giro versionadas                                   │
└────────────────────────────────────────────────────────────────────┘
```

**Decisiones clave**

1. **Una sola app** (PWA instalable en Android, iPhone, tablet y PC). Más adelante, si hace
   falta impresora térmica Bluetooth o lector de cámara más rápido, se envuelve con Capacitor
   **sin reescribir**.
2. **Multi-tenant en una sola base de datos** con `tenant_id` en cada tabla + RLS de Postgres.
   Es lo más barato y escalable hasta decenas de miles de negocios; si un cliente grande lo
   exige, se puede mover a su propio esquema después.
3. **Offline primero en la caja**: vender nunca depende del internet.
4. **El inventario es un libro de movimientos** (entrada, venta, ajuste, merma, devolución,
   traspaso). La existencia se calcula/cachea desde ahí. Esto da historial, auditoría y
   sincronización sin conflictos (los movimientos sólo se agregan, no se sobreescriben).

---

## 3. Selección y configuración del giro

### 3.1 El giro es una **plantilla de datos**, no código

```ts
// giros/farmacia.ts  (ejemplo resumido)
export const farmacia: PlantillaGiro = {
  id: 'farmacia', version: 3,
  nombre: 'Farmacia', icono: 'pill',
  modulos: ['ventas','caja','productos','inventario','compras','proveedores',
            'alertas','lotes-caducidad','clientes'],
  capacidades: { lotes: true, caducidad: true, granel: false, medidas: false,
                 variantes: false, receta: true, paquetes: true },
  unidades: ['pza','caja','frasco','sobre','ml'],
  atributosProducto: [
    { clave: 'sustanciaActiva', tipo: 'texto', requerido: true },
    { clave: 'presentacion',    tipo: 'texto' },
    { clave: 'requiereReceta',  tipo: 'booleano' },
    { clave: 'grupoCofepris',   tipo: 'opcion', opciones: ['I','II','III','IV','V','VI'] },
  ],
  categoriasIniciales: ['Analgésicos','Antibióticos','Cuidado personal','Bebés', '…'],
  alertas: { caducidadDias: [90, 30, 7], stockMinimoDefault: 3 },
  terminologia: { producto: 'medicamento', proveedor: 'laboratorio / distribuidor' },
  inicio: ['ventas.hoy','alertas.caducan','inventario.porAcabarse'],
};
```

### 3.2 Capacidades (el corazón de la flexibilidad)
El código **nunca** pregunta "¿es farmacia?"; pregunta "¿este negocio usa lotes?".

| Capacidad | Qué activa | Abarrotes | Minisúper | Tlapalería | Farmacia | Papelería |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `caducidad` | Fecha de vencimiento y alertas | ✅ | ✅ | — | ✅ | — |
| `lotes` | Varias fechas/lotes por producto, FEFO | opc. | ✅ | — | ✅ | — |
| `granel` | Venta por kg/litro con báscula | ✅ | ✅ | ✅ | — | — |
| `medidas` | Venta por metro/cm, cortes, conversiones | — | — | ✅ | — | opc. |
| `variantes` | Talla/color/medida/calibre | — | — | ✅ | — | ✅ |
| `paquetes` | Kits/paquetes/listas escolares | opc. | opc. | opc. | ✅ | ✅ |
| `temporadas` | Temporadas y preventa (regreso a clases) | — | — | — | — | ✅ |
| `receta` | Control de venta con receta / antibióticos | — | — | — | ✅ | — |
| `fiado` | Crédito a clientes | ✅ | opc. | ✅ | opc. | opc. |
| `reclamoProveedor` | Producto por cambiar al proveedor | ✅ | ✅ | opc. | ✅ | — |

Agregar un giro nuevo (ej. "Carnicería", "Refaccionaria") = **escribir una plantilla**, sin tocar módulos.

### 3.3 Flujo de onboarding (4 pasos, < 3 minutos)

1. **Cuenta**: teléfono (WhatsApp/SMS) o correo + nombre. Sin contraseña larga.
2. **Tu negocio**: nombre, giro (tarjetas grandes con ícono), alcaldía/municipio y estado.
3. **Ajusta en 1 pantalla**: preguntas sí/no derivadas de la plantilla
   ("¿Vendes a granel?", "¿Das fiado?", "¿Manejas productos con caducidad?") → encienden
   o apagan capacidades. Todo se puede cambiar después en Ajustes.
4. **Primeros productos**: "Escanea 5 productos" (se autocompletan del catálogo global) o
   "Importar desde Excel" o "Lo hago después". Termina en el Inicio con una venta de prueba.

Al terminar se crea: `tenant`, `sucursal principal`, `membresía dueño`, y una **copia
de la plantilla** con su versión (`config_negocio`). Cambios del negocio = *overrides* sobre la
plantilla, para poder mejorar plantillas sin pisar lo que el negocio personalizó.

---

## 4. Módulos compartidos vs específicos

**Núcleo (todos los giros):** Onboarding · Ajustes del negocio · Usuarios y roles ·
Productos (catálogo, códigos de barras, categorías, precios, unidades) · Inventario
(existencias, movimientos, ajustes, mínimos) · Ventas / Punto de venta · Caja (apertura, corte) ·
Compras / entrada de mercancía · Proveedores · Alertas · Reportes básicos · Sincronización offline.

**Módulos por capacidad (se activan, no se duplican):**
Lotes y caducidades · Granel/báscula · Medidas y conversiones · Variantes · Paquetes/kits ·
Fiado y clientes · Temporadas · Control de recetas · Reclamos a proveedor.

**Futuros (fase 4+):** Facturación CFDI 4.0 (vía PAC) · Multi-sucursal y traspasos ·
Pedidos a proveedor sugeridos · Tienda en línea / pedidos por WhatsApp · Recargas y pago de servicios.

### Modelo de datos (tablas principales)
```
tenants · sucursales · usuarios · membresias(tenant, usuario, rol)
config_negocio(tenant, plantilla_id, version, overrides jsonb)
unidades · conversiones(producto, de_unidad, a_unidad, factor)   -- caja=24 pza, rollo=100 m
categorias · productos(tenant, nombre, codigo_barras, unidad_base, precio_centavos,
                       costo_centavos, minimo, atributos jsonb)  -- validados por la plantilla
variantes(producto, atributos)  · lotes(producto, lote, caducidad, cantidad)
movimientos_inventario(tenant, sucursal, producto, lote?, tipo, cantidad, origen, creado_en, dispositivo_id)
ventas · venta_partidas · pagos · cortes_caja
compras · compra_partidas · proveedores · reclamos_proveedor
clientes · cuentas_fiado · alertas
catalogo_global(codigo_barras, nombre, marca, imagen)  -- compartido, sin tenant
```

### Roles iniciales
| Rol | Puede |
|---|---|
| Dueño | Todo, incluidos costos, ganancias, usuarios y ajustes |
| Encargado | Inventario, compras, reportes; sin usuarios ni ajustes fiscales |
| Cajero | Vender, cobrar, abrir/cerrar su caja; no ve costos ni puede anular sin autorización |

Permisos granulares (`ventas.anular`, `inventario.ajustar`, `reportes.ganancia`) para crear roles a medida después.

---

## 5. Coordinación de los tres Skills

Skills creados en `.claude/skills/`: **ux-ui-designer**, **react-developer**, **qa-tester**
(más **investigar-sistemas-tienda**, de la etapa anterior). Detalle del flujo en `docs/FLUJO-DE-TRABAJO.md`.

```
 Requerimiento
      │
 1. UX/UI ──► 01-diseno.md  (Propuesto) ──► Tú apruebas ──► (Aprobado)
      │
 2. React Dev ──► 02-implementacion.md + código + pruebas
      │
 3. QA ──► 03-qa.md + BUG-XXXX.md ──┐
      │                              │ bugs Críticos/Altos
 4. React Dev corrige ◄──────────────┘
      │
 5. UX/UI ──► 04-revision-ux.md (¿respeta el diseño?)
      │
 6. QA ──► validación final + regresión ──► ✅ Terminado
```

**Definición de "Terminado"**: diseño aprobado · criterios de aceptación cumplidos · 0 bugs
Críticos/Altos abiertos · revisión UX sin ❌ · regresión en verde · probado en ≥ 2 giros.

> Nota honesta: los Skills son "manuales de rol" que yo sigo. Para que QA sea realmente
> independiente, lo puedo ejecutar como **sub-agente separado** que sólo ve el diseño y la app,
> no el razonamiento de quien programó.

---

## 6. Estructura inicial del proyecto React

```
app-tiendas/
├─ .claude/skills/           ux-ui-designer · react-developer · qa-tester · investigar-sistemas-tienda
├─ docs/
│  ├─ propuesta-arquitectura.md · FLUJO-DE-TRABAJO.md
│  ├─ design-system/         tokens, decisiones visuales
│  ├─ funcionalidades/<id>/  01-diseno · 02-implementacion · 03-qa · 04-revision-ux
│  ├─ qa/bugs/               BUG-0001.md …
│  └─ investigacion/
├─ supabase/                 migraciones SQL, políticas RLS, funciones
└─ web/                      (React + TS + Vite, PWA)
   └─ src/
      ├─ app/                providers, router, layouts móvil/escritorio
      ├─ design-system/      tokens.css, Button, Input, Card, DataTable, Badge, Scanner…
      ├─ platform/           tenant · capabilities · modules (registro) · permissions · i18n
      ├─ giros/              abarrotes.ts · minisuper.ts · tlapaleria.ts · farmacia.ts · papeleria.ts
      ├─ modules/            onboarding · ventas · caja · productos · inventario · compras ·
      │                      proveedores · clientes · alertas · lotes-caducidad · reportes · ajustes
      ├─ data/               api · db (Dexie) · sync
      └─ shared/             dinero · cantidades · fechas (zona horaria) · validaciones
```

**Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form + Zod,
Zustand, Dexie, vite-plugin-pwa, Radix UI (accesibilidad) bajo el DS propio, Vitest,
Testing Library, Playwright.

---

## 7. Riesgos técnicos y de escalabilidad

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | **Querer los 5 giros a la vez** | Nunca se lanza | MVP sólo abarrotes/minisúper; la arquitectura ya contempla los demás |
| 2 | **Fuga de datos entre negocios** | Crítico (legal y de confianza) | RLS en todas las tablas, `tenant_id` desde el JWT, pruebas automáticas de aislamiento en CI, limpiar IndexedDB al cambiar de cuenta |
| 3 | **Sincronización offline** (ventas duplicadas, stock negativo) | Alto | Movimientos con UUID generado en el dispositivo (idempotentes), sólo se agregan, conflictos resueltos en servidor; aceptar stock negativo temporal y alertarlo |
| 4 | **"if giro" regado por el código** | Mantenimiento imposible | Regla de capacidades + revisión en QA + lint que prohíba comparar `giro ===` |
| 5 | **Atributos flexibles (jsonb) lentos o desordenados** | Medio | Validación con esquema de la plantilla; índices GIN sólo en atributos que se filtran |
| 6 | **Unidades y decimales** (0.250 kg, 3.5 m, caja de 24) | Alto (cobros mal) | Dinero en centavos enteros, cantidades `numeric(12,3)`, conversiones en tabla, pruebas de redondeo |
| 7 | **Evolución de plantillas** vs personalizaciones del negocio | Medio | Plantillas versionadas + overrides; migraciones de plantilla explícitas |
| 8 | **Regulación farmacia** (antibióticos con receta, controlados) | Alto si se ignora | Lanzar farmacia sin medicamentos controlados; consultar requisitos COFEPRIS antes de esa fase |
| 9 | **Facturación CFDI** | Medio | Fuera del MVP; integrar un PAC en fase 4. Leer XML de compras sí desde fase 2 (sin PAC) |
| 10 | **Hardware** (impresoras térmicas, cajones, básculas) desde navegador | Medio | Ticket por WhatsApp/PDF primero; impresión Bluetooth con Capacitor después |
| 11 | **Escaneo con cámara en Android barato** | Medio | BarcodeDetector nativo + respaldo zxing; soportar lectores USB (actúan como teclado) |
| 12 | **Catálogo global sucio** (tiendas suben nombres mal) | Bajo-medio | El global sólo sugiere; cada negocio tiene su copia editable |
| 13 | **Fuente y marca de terceros** en los tokens recibidos | Legal | Tokens renombrados, fuente Inter libre, sin elementos de marca ajenos |
| 14 | **Contraste** de algunos colores del set | Accesibilidad | Marigold/coral sólo como fondo; añadidos colores semánticos AA |

**Escalabilidad por ciudades:** nada en el modelo depende de CDMX. Cada sucursal tiene
estado, municipio, código postal y zona horaria (México tiene 4 zonas). Impuestos (IVA 16 %,
0 % en alimentos básicos y medicinas, IEPS) van en la configuración del producto, no en código.

---

## 8. Plan por fases (propuesto)

| Fase | Contenido | Resultado |
|---|---|---|
| **0. Cimientos** | Design system + tokens, shell, registro de módulos, capacidades, auth, RLS, onboarding | Registrarse y elegir giro |
| **1. MVP Abarrotes/Minisúper** | Productos con escáner, venta, caja, inventario, mínimos, caducidad + alertas, offline | Una tienda real lo puede usar |
| **2. Compras** | Proveedores, entrada de mercancía por escáner/XML CFDI/foto, lotes, reclamos a proveedor, fiado | Inventario que se llena solo |
| **3. Más giros** | Tlapalería (medidas, variantes), Papelería (paquetes, temporadas), Farmacia (receta) | Plantillas nuevas, mismos módulos |
| **4. Crecimiento** | CFDI vía PAC, multi-sucursal, pedidos sugeridos, reportes avanzados | Negocios más grandes |

---

## 9. Decisiones que necesito de ti para empezar
1. ¿Aprobamos **Supabase** como backend (ya está conectado a esta sesión) o prefieres otro?
2. ¿MVP con **abarrotes + minisúper** primero?
3. ¿Color de acción **azul** (tus tokens) y verde sólo para "en existencia/éxito"?
4. ¿Creamos un **repositorio en GitHub** para no perder nada? (este contenedor es temporal)
