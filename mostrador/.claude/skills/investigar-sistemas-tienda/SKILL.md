---
name: investigar-sistemas-tienda
description: Investiga sistemas de punto de venta (POS), inventario, caducidades y escaneo de tickets/facturas para tiendas pequeñas (abarrotes, misceláneas, minisúpers, colmados) y convierte lo encontrado en decisiones de producto para la app "app-tiendas". Úsalo cuando el usuario pida investigar competidores, funciones, precios, APIs (códigos de barras, OCR, facturación electrónica), reglas fiscales por país, o cuando haya que decidir qué construir a continuación. Disparadores: "investiga", "competencia", "qué tienen otros sistemas", "cómo lo hace Eleventa/Loyverse/Treinta", "qué API uso para…", "siguiente función".
---

# Investigación de sistemas para tiendas

Objetivo: que cada investigación termine en algo construible para **app-tiendas**: una app
súper poderosa pero que el tendero use sin capacitación (escanear → listo).

## Principios del producto (filtra todo lo que encuentres con esto)

1. **Escanear primero, teclear casi nunca.** Código de barras, foto del ticket, XML de factura.
2. **Funciona sin internet** y sincroniza después (muchas tiendas tienen señal mala).
3. **Celular primero** (Android barato), tablet y PC como extra.
4. **Alertas que avisan solas**: "se te acaba", "se vence en 5 días", "el proveedor no te lo cambió".
5. **Cero jerga contable.** "Lo que vendiste hoy", no "reporte de ingresos".
6. Una función nueva sólo entra si ahorra tiempo o dinero medible al tendero.

## Flujo de trabajo

1. **Aclara la pregunta** en una línea: ¿qué función o decisión se está investigando? ¿país?
   (México por defecto si no se dice; cambia fiscalidad y proveedores.)
2. **Revisa lo ya investigado** en `docs/investigacion/` para no repetir búsquedas.
3. **Busca** (WebSearch `standard`; `extended` sólo si los resultados son pobres o viejos).
   Lanza en paralelo búsquedas en español e inglés. Usa las plantillas de
   `references/consultas.md` y la lista de sistemas de `references/competidores.md`.
4. **Verifica**: los blogs de proveedores son publicidad. Prefiere documentación oficial,
   reseñas de Capterra/GetApp/Play Store, y fichas técnicas. Marca cada dato como
   `confirmado` (fuente oficial) o `por verificar` (blog/marketing).
5. **Extrae para cada sistema**: funciones clave, cómo resuelven el escaneo, caducidades,
   alertas de stock, offline, precio, país, quejas frecuentes de usuarios (¡oro puro!).
6. **Traduce a producto**: para cada hallazgo escribe "→ Para app-tiendas: …" con una
   recomendación concreta (copiar, mejorar, evitar).
7. **Guarda** el resultado en `docs/investigacion/AAAA-MM-DD-<tema>.md` con el formato de abajo
   y actualiza `docs/investigacion/INDICE.md`.
8. **Propón el siguiente paso**: la función o prueba técnica más valiosa para construir ya.

## Formato del reporte

```markdown
# <Tema> — <fecha>
**Pregunta:** …
**País/mercado:** …

## Resumen (3–5 viñetas)
## Hallazgos por sistema / tecnología
| Sistema | Qué hace bien | Debilidad / quejas | Precio | Estado del dato |
## Decisiones para app-tiendas
- → …
## Riesgos y dudas abiertas
## Fuentes
- [título](url)
```

## Áreas que siempre conviene cubrir

- **Catálogo por código de barras**: Open Food Facts (gratis, cobertura irregular en LatAm;
  probar con prefijo 750 de México), GS1 del país, bases propias compartidas entre tiendas.
- **Entrada de mercancía**: en México el **XML CFDI 4.0** de la factura del proveedor trae
  `Conceptos` (cantidad, descripción, `NoIdentificacion`, valor unitario) → más fiable que OCR.
  Para tickets en papel: OCR / modelo de visión que devuelva renglones estructurados.
- **Caducidades**: control por **lote** (mismo producto, distintas fechas), FEFO
  (primero en caducar, primero en salir), alertas a 30/14/7 días, registro de mermas con motivo,
  y **reclamos a proveedor** (producto que debía cambiar y no cambió).
- **Stock**: mínimos por producto, sugerencia de pedido según ventas promedio.
- **Fiscal**: SAT/CFDI (México), e-CF Ley 32-23 (Rep. Dominicana, desde 15-may-2026), DIAN (Colombia), etc.
- **Operación de tiendita**: venta a granel, fiado/crédito a clientes, corte de caja, recargas y servicios.

## Reglas

- No inventes precios ni funciones: si no hay fuente, escribe "por verificar".
- Cita siempre las fuentes con enlaces.
- No mandes datos del usuario ni de sus clientes a servicios externos al buscar.
