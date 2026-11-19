# Arquitectura frontend (resumen operativo)

Detalle completo y justificación en `docs/propuesta-arquitectura.md`.

## Stack
React 19 + TypeScript + Vite · React Router · TanStack Query · React Hook Form + Zod ·
Zustand (UI) · Dexie (IndexedDB, offline) · vite-plugin-pwa · Radix UI primitives bajo el DS
propio · Vitest + Testing Library · Playwright (e2e) · Escáner: `BarcodeDetector` nativo con
respaldo `@zxing/browser`; lectores USB/Bluetooth como teclado.

## Estructura
```
src/
  app/            providers, router, layouts (móvil / escritorio)
  design-system/  tokens.css, componentes base, sin lógica de negocio
  platform/
    tenant/       sesión, negocio activo, sucursal activa
    capabilities/ useCapability, <IfCapability>
    modules/      registro de módulos (rutas, menú, permisos, capacidades requeridas)
    permissions/  roles, can('ventas.anular')
    i18n/         textos + terminología por giro
  giros/          configs de giro (datos): abarrotes, tlapaleria, farmacia, papeleria, minisuper
  modules/        ventas, caja, productos, inventario, compras, proveedores, clientes,
                  reportes, alertas, lotes-caducidad, onboarding, ajustes
    <modulo>/     index.ts (manifest) · pages/ · components/ · hooks/ · api.ts · schema.ts
  data/           cliente API, db local (Dexie), cola de sincronización
  shared/         utilidades puras (dinero, cantidades, fechas)
```

## Manifest de módulo
```ts
export const inventario: ModuleManifest = {
  id: 'inventario',
  requiere: { capacidades: [], permisos: ['inventario.ver'] },
  rutas: [{ path: '/inventario', lazy: () => import('./pages/InventarioPage') }],
  menu: { etiqueta: 't:menu.inventario', icono: 'boxes', orden: 30 },
  widgetsInicio: ['inventario.porAcabarse'],
};
```
El shell sólo monta los módulos activos para el negocio y permitidos para el rol.
