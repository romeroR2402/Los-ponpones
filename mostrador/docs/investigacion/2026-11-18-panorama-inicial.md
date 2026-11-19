# Panorama inicial: sistemas para tiendas — 2026-11-18
**Pregunta:** ¿Qué existe hoy y qué hueco puede llenar app-tiendas (escaneo, inventario, ventas, tickets, caducidades)?
**País/mercado:** México por defecto (por confirmar con el usuario); notas para RD.

## Resumen
- Los POS para abarrotes (Eleventa, SICAR, Alegra…) cubren venta, inventario con mínimos, granel, fiado y corte de caja, pero **casi ninguno trata bien las caducidades**.
- Las apps de caducidades (BatchDue, SimSim Track, Best By Manager) son **apps sueltas**: no se conectan con las ventas ni el inventario.
- El escaneo de facturas/tickets con OCR existe (Veryfi, Parseur, Vyapar), pero es caro o pensado para contabilidad, no para la tiendita.
- **Hueco:** una sola app de celular que junte venta + inventario + entrada de mercancía por foto/XML + caducidades por lote + reclamos al proveedor.

## Hallazgos por sistema / tecnología
| Sistema | Qué hace bien | Debilidad | Precio | Estado |
|---|---|---|---|---|
| Guías POS abarrotes MX | Granel, pieza, fiado, mínimos, corte de caja, CFDI | Contenido de proveedores | — | por verificar |
| SICAR | POS nube, ficha específica abarrotes | Orientado a PC | — | por verificar |
| SIFO | Inventario tiempo real + monitoreo de caducidades | Poca info pública | — | por verificar |
| BatchDue | Lotes + alertas 7/14/30 días, pensado para tiendita | Sólo iPad, sin ventas | Gratis + compras | por verificar |
| SimSim Track | Escaneo de código + alertas de caducidad | Sin POS | — | por verificar |
| Best By Manager | Aviso a 7 días + registro de mermas con motivo | Sólo Android, sin POS | — | por verificar |
| Veryfi | OCR de facturas con renglones | Mínimo ~US$500/mes | Caro | por verificar |
| Vyapar | Foto de factura → actualiza stock | Mercado India | — | por verificar |
| Open Food Facts | API gratis por código de barras | Cobertura irregular fuera de Europa | Gratis | confirmado (API abierta) |

## Decisiones para app-tiendas
- → **Lotes con fecha de caducidad** desde el día 1 (mismo producto, varias fechas) y venta FEFO.
- → Alertas automáticas a 30/14/7/1 días + lista "vender primero / poner en oferta".
- → **Reclamo a proveedor**: al recibir, marcar "producto a cambio"; si llega la fecha y no se cambió, alerta.
- → Entrada de mercancía en 3 vías: escanear código, **subir XML CFDI** (exacto y gratis), foto de ticket con modelo de visión (más barato que Veryfi).
- → Catálogo: Open Food Facts + catálogo compartido entre tiendas de la app (crece solo).
- → Sugerencia de pedido: "te quedan 3 días de leche al ritmo de venta actual".
- → Offline primero, Android barato, interfaz con botones grandes.

## Riesgos y dudas abiertas
- País objetivo (cambia facturación: SAT México vs e-CF RD obligatoria desde 15-may-2026).
- Precisión del OCR en tickets térmicos arrugados.
- Cobertura real de Open Food Facts con códigos 750.

## Fuentes
- [Yo-Facturo: qué debe tener un POS para abarrotes en México](https://yo-facturo.com/blog/punto-de-venta-para-abarrotes-mexico-que-debe-tener/)
- [Alegra: sistema para colmados (RD, e-CF)](https://blog.alegra.com/republica-dominicana/sistema-inteligente-para-colmados/)
- [SICAR ficha abarrotes](https://fichas.sicar.mx/PDFs/Ficha_Abarrotes.pdf) · [SICAR en Capterra](https://www.capterra.com/p/201314/SICAR-Punto-de-Venta/)
- [SIFO en GetApp](https://www.getapp.co.uk/software/2093038/sifo-point-of-sale)
- [Tienditas 2.0](https://emprendedor.com/tienditas-2-0-asi-se-estan-modernizando-los-changarros-para-competir-en-2025/) · [BEES de Grupo Modelo](https://dplnews.com/grupo-modelo-digitaliza-pedidos-con-bees-ia-generativa/)
- [BatchDue](https://apps.apple.com/pl/app/batchdue/id6774978600) · [SimSim Track](https://www.getapp.com/all-software/a/simsim-track/) · [Best By Manager](https://joshua-werlein.github.io/BestByManager/about.html)
- [Veryfi Invoice OCR](https://www.veryfi.com/page/2/careers/engineering/invoice-ocr-api/) · [Parseur](https://parseur.com/blog/food-processing-supplier-invoice-automation) · [Vyapar OCR](https://vyaparapp.in/ocr-scanner-software) · [HyperVerge](https://hyperverge.co/blog/receipt-scanner-app/)
- [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-documentation/docs/Product-Opener/v2)
