import csv, json, re, sys
TAGS = [  # se revisan en orden; coincidencia EXACTA de etiqueta
 ("Vinos y licores", {"en:alcoholic-beverages","en:beers","en:wines","en:spirits","en:tequilas"}),
 ("Salchichonería", {"en:prepared-meats","en:hams","en:sausages","en:cold-cuts","en:bacon"}),
 ("Lácteos", {"en:dairies","en:milks","en:yogurts","en:cheeses","en:fermented-milk-products","en:dairy-desserts","en:milks-liquid-and-powder","en:creams","en:butters"}),
 ("Galletas", {"en:biscuits","en:biscuits-and-crackers","en:cookies","en:crackers"}),
 ("Pan", {"en:breads","en:cakes","en:pastries","en:tortillas","en:viennoiseries"}),
 ("Dulces", {"en:confectioneries","en:chocolates","en:candies","en:chewing-gum","en:cocoa-and-its-products"}),
 ("Botanas", {"en:salty-snacks","en:chips-and-fries","en:crisps","en:nuts-and-their-products","en:appetizers","en:popcorn"}),
 ("Cereales", {"en:breakfast-cereals"}),
 ("Bebés", {"en:baby-foods","en:baby-milks"}),
 ("Congelados", {"en:frozen-foods","en:frozen-desserts"}),
 ("Bebidas", {"en:beverages","en:waters","en:sodas","en:carbonated-drinks","en:juices-and-nectars","en:coffees","en:teas","en:instant-beverages","en:plant-based-beverages"}),
 ("Mascotas", {"en:pet-food","en:dog-food","en:cat-food"}),
]
PALABRAS = [
 ("Vinos y licores", r"\b(cerveza|vino|tequila|mezcal|whisky|ron|vodka|brandy)\b"),
 ("Salchichonería", r"\b(jam[oó]n|salchicha|chorizo|tocino|salami|mortadela|pechuga de pavo)\b"),
 ("Lácteos", r"\b(leche|yogh?urt?|queso|crema|mantequilla|jocoque|lala|alpura)\b"),
 ("Galletas", r"\b(galletas?|cookies?)\b"),
 ("Pan", r"\b(pan|bimbo|tortillas?|panqu[eé]|mantecadas?|conchas?)\b"),
 ("Dulces", r"\b(chocolate|dulces?|chicles?|paletas?|gomitas?|caramelos?|malvaviscos?)\b"),
 ("Botanas", r"\b(papas|cacahuates?|botana|fritos|doritos|cheetos|sabritas|chicharr[oó]n|palomitas)\b"),
 ("Cereales", r"\b(cereal|avena|granola|corn flakes)\b"),
 ("Bebidas", r"\b(refresco|agua|jugo|n[eé]ctar|bebida|caf[eé]|t[eé]|soda|coca|pepsi|gatorade|electrolit)\b"),
 ("Higiene", r"\b(shampoo|champ[uú]|jab[oó]n|pasta dental|desodorante|toallas femeninas|papel higi[eé]nico)\b"),
 ("Limpieza", r"\b(detergente|cloro|limpiador|suavizante|lavatrastes|fabuloso)\b"),
 ("Mascotas", r"\b(croquetas|perro|gato|mascota)\b"),
]
def cat(tags, nombre=""):
    t = set(x.strip() for x in tags.lower().split(","))
    for c, ws in TAGS:
        if t & ws: return c
    n = nombre.lower()
    for c, rx in PALABRAS:
        if re.search(rx, n): return c
    return "Abarrotes"
def limpio(s): return re.sub(r"\s+", " ", (s or "").replace("\\n"," ")).strip()
vistos, out = set(), []
for row in csv.reader(open(sys.argv[1], encoding="utf-8", errors="replace"), delimiter="\t", quoting=csv.QUOTE_NONE):
    if len(row) < 7: continue
    code, nombre, qty, brands, tags, main, img = [limpio(x) for x in row[:7]]
    code = code.lstrip("0") if len(code) == 14 else code
    if not re.fullmatch(r"\d{8,13}", code) or code in vistos: continue
    if len(code) == 12: code = "0" + code if False else code
    nombre = nombre[:110]
    if len(nombre) < 3: continue
    marca = brands.split(",")[0].strip()[:60]
    qty = qty[:30]
    full = nombre
    if marca and marca.lower() not in nombre.lower(): full += " " + marca
    if qty and qty.lower().replace(" ","") not in nombre.lower().replace(" ",""): full += " " + qty
    if not img.startswith("https://images.openfoodfacts.org/"): img = ""
    vistos.add(code)
    out.append({"codigo": code, "nombre": full[:120], "marca": marca, "presentacion": qty, "categoria": cat(tags, nombre), "imagen": img})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
from collections import Counter
print(len(out), Counter(o["categoria"] for o in out).most_common(20), sum(1 for o in out if o["imagen"]), "con foto")
