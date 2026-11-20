---
name: investigar-pos
description: Investiga qué ofrecen las apps de pedidos y punto de venta de cadenas grandes (McDonald's, Burger King, Domino's, Little Caesars, Starbucks, KFC, Rappi, Uber Eats, DiDi Food), qué les molesta a sus clientes, y lo compara con la app de Casa de Los Ponpones para proponer y hacer mejoras. Úsalo cuando el dueño pida "investigar la competencia", "qué le falta a mi app", "qué no les gusta a los clientes" o "mejorar el POS".
---

# Investigar POS y apps de pedidos

Guía para comparar la app de **Casa de Los Ponpones** con las apps de pedidos de cadenas grandes y convertir lo aprendido en mejoras concretas. El dueño es principiante y habla español: explica todo en español, con pasos cortos.

## 1. Conoce primero la app actual

Antes de comparar, revisa qué ya existe para no proponer algo repetido:

- Un solo `index.html` (HTML + CSS + JS sin framework), `config.js` con la clave pública de Supabase, `manifest.webmanifest`, `sw.js` e `icons/` (app instalable).
- Supabase (proyecto `vsmseukmtshfkswlhdmq`): tablas `orders`, `tienda`, `clientes`, `ventas`, `inventario`, `compras`. RLS activo: el público solo crea pedidos con la tienda abierta; el dueño (`dueno@ponpones.com`) ve y cambia todo. Funciones `mis_pedidos`, `mis_compras`, `vincular_compras`, `calificar`.
- Busca en el código: `function openP`, `function sendO`, `function drawMine`, `function drawOrders`, `function drawSales`, `function drawInv`, `function tkOpen` para entender menú, envío, seguimiento, pedidos, ventas, inventario y lector de tickets.

## 2. Investiga (fuentes)

Para cada app de referencia, junta:

1. **Qué ofrece**: pedir para llevar, entrega, programar hora, combos, personalización, favoritos, "pedir otra vez", recompensas/puntos, cupones, pago en la app, seguimiento en tiempo real, tiempo estimado, avisos, calificaciones, información de alérgenos, kiosco y POS en mostrador.
2. **Qué les molesta a los clientes**: reseñas de Google Play y App Store (1 y 2 estrellas), Reddit, noticias y Profeco. Quejas típicas: cuenta obligatoria, app lenta o que se cae, pedidos equivocados o incompletos, cupones que no aplican, precios más caros en la app, tiempo de espera sin aviso, cobros dobles, mal soporte, demasiadas notificaciones y mal manejo de datos personales.

Si hay herramienta de búsqueda o el agente `web-fetch`, usa fuentes reales y cítalas. Si no, dilo con claridad y trabaja con lo conocido. Nunca inventes cifras ni citas.

## 3. Compara y prioriza

Haz una tabla: **función → la tienen ellos → la tiene Ponpones → qué falta**.

Prioriza por: (a) evita una queja frecuente, (b) es fácil y barato para un negocio pequeño, (c) no pone en riesgo pedidos, ventas ni datos. Marca aparte lo que necesita pago o servicios externos (SMS, pasarela de pago, WhatsApp Business API) y pregunta antes.

## 4. Implementa con las reglas del proyecto

- Cambios pequeños y puntuales en `index.html`. No reescribas el archivo ni imprimas el base64 de las imágenes.
- Base de datos: antes de cambiar, haz respaldo en el esquema `respaldo`. Solo **agrega** (tablas, columnas o funciones). Nunca borres datos. RLS siempre activo y permisos mínimos.
- Prueba con Playwright y Supabase simulado: cliente, dueño, modo claro y oscuro, sin errores. Vuelve a correr las pruebas anteriores.
- Manda capturas al dueño y **espera su "súbelo"** antes de hacer push a `main`.

## 5. Entrega

Resumen corto en español: qué encontraste, qué ya tiene la app, qué hiciste, qué falta y cuánto costaría (si aplica), y cómo probarlo desde el celular.
