# Catálogo de productos (Open Food Facts → `mos_catalogo`)

Carga hecha el 19 nov 2026: **24,947 productos** (19,052 con foto) vendidos en México o con código 750.

Para actualizarlo:
1. Descargar y filtrar (≈1.5 GB comprimido, se procesa al vuelo sin guardarlo):
   `curl -sL https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz | gunzip | awk -F'\t' 'NR>1 && ($41 ~ /en:mexico/ || $1 ~ /^750[0-9]{10}$/) && $11 != "" {print $1"\t"$11"\t"$14"\t"$19"\t"$23"\t"$82"\t"$84"\t"$7}' > off_mx.tsv`
2. Limpiar y poner categoría: `python3 limpiar.py off_mx.tsv catalogo.json`
3. Subir por lotes de 2,000 con una función temporal protegida por clave de un solo uso y borrarla al terminar
   (los productos que aportaron las tiendas no se sobrescriben).

Licencia: datos de Open Food Facts bajo ODbL — la app muestra "Datos del producto: Open Food Facts".
