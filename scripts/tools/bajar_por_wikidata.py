"""
Tercera pasada: el escudo sale de Wikidata, no del artículo.

La lista de imágenes de un artículo de Wikipedia no siempre trae el escudo: en
muchos clubes la ficha lo toma de Wikidata, así que el archivo no figura entre
las imágenes de la página y aparecen los sponsors, las banderas y las fotos de
jugadores. Wikidata lo tiene en la propiedad P154, que es literalmente "imagen
del logo".

    python3 scripts/tools/bajar_por_wikidata.py
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "olimpia-manager/1.0 (proyecto personal de un hincha; contacto: ivan@blackmont.com.py)"

TITULOS = {
 "corinthians": "Sport Club Corinthians Paulista",
 "colo_colo": "Club Social y Deportivo Colo-Colo",
 "cobresal": "Club de Deportes Cobresal",
 "ohiggins": "Club Deportivo O'Higgins",
 "aguilas": "Águilas Doradas Rionegro",
 "ldu": "Liga Deportiva Universitaria",
 "delfin": "Delfín Sporting Club",
 "orense": "Orense Sporting Club",
 "libertad_ecu": "Libertad Fútbol Club (Ecuador)",
 "cesar_vallejo": "Club Universidad César Vallejo",
 "cusco_fc": "Cusco Fútbol Club",
 "sport_huancayo": "Club Sport Huancayo",
 "real_tomayapo": "Club Real Tomayapo",
 "guabira": "Club Deportivo Guabirá",
 "caracas": "Caracas Fútbol Club",
 "tachira": "Deportivo Táchira Fútbol Club",
 "carabobo": "Carabobo Fútbol Club",
 "la_guaira": "Deportivo La Guaira Fútbol Club",
 "metropolitanos": "Metropolitanos Fútbol Club",
 "monagas": "Monagas Sport Club",
 "puerto_cabello": "Academia Puerto Cabello",
 "rayo_zuliano": "Rayo Zuliano",
}

def pedir(url, binario=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read() if binario else json.loads(r.read())

def entidad(titulo):
    """El identificador de Wikidata del artículo."""
    for idioma in ("es", "en"):
        try:
            d = pedir(f"https://{idioma}.wikipedia.org/w/api.php?action=query&format=json"
                      f"&prop=pageprops&redirects=1&titles=" + urllib.parse.quote(titulo))
            for p in d.get("query", {}).get("pages", {}).values():
                q = (p.get("pageprops") or {}).get("wikibase_item")
                if q: return q
        except Exception:
            pass
    return None

def archivoDelLogo(q):
    """P154 es la imagen del logo; P41 la bandera, como respaldo."""
    d = pedir(f"https://www.wikidata.org/wiki/Special:EntityData/{q}.json")
    ent = d["entities"][q]
    for prop in ("P154", "P8972", "P18"):
        for c in ent.get("claims", {}).get(prop, []):
            valor = c.get("mainsnak", {}).get("datavalue", {}).get("value")
            if isinstance(valor, str):
                return valor
    return None

def urlEnCommons(archivo):
    d = pedir("https://commons.wikimedia.org/w/api.php?action=query&format=json"
              "&prop=imageinfo&iiprop=url&titles=File:" + urllib.parse.quote(archivo))
    for p in d.get("query", {}).get("pages", {}).values():
        for ii in p.get("imageinfo", []) or []:
            # la URL viene con parámetros de campaña pegados atrás 
            return (ii.get("url") or "").split("?")[0]
    return None

def buscarEnCommons(nombre):
    """
    Último recurso: buscar el archivo en Commons por el nombre del club.

    Se pide la categoría de archivos y se elige el que se llame como un escudo.
    Es lo que uno haría a mano, y falla cuando el club no tiene ningún archivo
    libre subido, que es el caso de varios clubes chicos: su escudo está en
    Wikipedia como uso legítimo y no se puede redistribuir.
    """
    d = pedir("https://commons.wikimedia.org/w/api.php?action=query&format=json"
              "&list=search&srnamespace=6&srlimit=12&srsearch="
              + urllib.parse.quote(f"{nombre} escudo logo"))
    for r in d.get("query", {}).get("search", []):
        t = r["title"]
        if not re.search(r"\.(png|svg|jpg|jpeg)$", t, re.I): continue
        if re.search(r"map|mapa|stadium|estadio|kit|camiseta|flag|bandera", t, re.I): continue
        if not re.search(r"escudo|logo|crest|badge|emblem|shield", t, re.I): continue
        return t[5:]
    return None


def main():
    archivos = json.load(open("data/escudos.json"))
    bajados, siguen = [], []

    for cid, titulo in TITULOS.items():
        try:
            q = entidad(titulo)
            archivo = None
            if not q:
                archivo = buscarEnCommons(titulo)
                if not archivo:
                    siguen.append((cid, "sin entidad en Wikidata")); continue
            archivo = archivo or (archivoDelLogo(q) if q else None)
            if not archivo:
                archivo = buscarEnCommons(titulo)
            if not archivo:
                siguen.append((cid, "sin logo libre en Wikimedia")); continue
            url = urlEnCommons(archivo)
            if not url: siguen.append((cid, "no está en Commons")); continue
            ext = url.rsplit(".", 1)[-1].lower()
            if ext not in ("png", "svg", "jpg", "jpeg"):
                siguen.append((cid, f"formato {ext}")); continue
            datos = pedir(url, binario=True)
            if len(datos) < 700: siguen.append((cid, "archivo chico")); continue
            open(f"public/escudos/{cid}.{ext}", "wb").write(datos)
            archivos[cid] = ext
            bajados.append((cid, ext, len(datos), archivo[:50]))
        except Exception as e:
            siguen.append((cid, str(e)[:50]))
        time.sleep(0.25)

    json.dump(dict(sorted(archivos.items())), open("data/escudos.json", "w"),
              indent=1, ensure_ascii=False)
    print(f"\n  bajados: {len(bajados)}   siguen: {len(siguen)}\n")
    for cid, ext, n, nombre in bajados:
        print(f"    {cid:18} {ext:4} {n//1024:4} KB  {nombre}")
    for cid, por in siguen:
        print(f"    {cid:18} — {por}")

if __name__ == "__main__":
    main()
