# Flujo de trabajo entre Skills

Cada funcionalidad vive en `docs/funcionalidades/<id>-<nombre>/` (ej. `F-003-entrada-mercancia/`).

| Paso | Skill | Entrada | Salida | Puerta para avanzar |
|---|---|---|---|---|
| 1 | ux-ui-designer | Requerimiento | `01-diseno.md` (Propuesto) | Usuario lo marca **Aprobado** |
| 2 | react-developer | Diseño aprobado | Código + `02-implementacion.md` | lint, typecheck y tests en verde |
| 3 | qa-tester | Diseño + build | `03-qa.md`, `qa/bugs/BUG-*.md` | Veredicto |
| 4 | react-developer | Bugs abiertos | Correcciones (commit con ID del bug) | Bugs en "Corregido" |
| 5 | ux-ui-designer | Build corregido | `04-revision-ux.md` | Sin ❌ |
| 6 | qa-tester | Todo lo anterior | Validación final + regresión | **Terminado** |

## Definición de Terminado
- [ ] Diseño aprobado por el usuario
- [ ] Criterios de aceptación cumplidos
- [ ] 0 bugs Críticos o Altos abiertos
- [ ] Revisión UX sin desviaciones bloqueantes
- [ ] Probado en ≥ 2 giros con capacidades distintas
- [ ] Regresión completa en verde

## Registro de funcionalidades
| ID | Funcionalidad | Fase | Estado |
|---|---|---|---|
| F-001 | Design system base + tokens | 0 | Pendiente |
| F-002 | Onboarding y selección de giro | 0 | Pendiente |
| F-003 | Productos con escáner | 1 | Pendiente |
| F-004 | Punto de venta y caja | 1 | Pendiente |
| F-005 | Inventario, mínimos y alertas | 1 | Pendiente |
| F-006 | Caducidades y lotes | 1 | Pendiente |
