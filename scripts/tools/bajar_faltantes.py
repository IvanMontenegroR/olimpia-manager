"""
Segunda pasada para los escudos que la primera no encontró.

`pageimages` devuelve la imagen destacada del artículo y a veces no hay
ninguna: pasa cuando el escudo está subido como archivo no libre, que Wikipedia
no expone por esa vía. Para esos se pide la LISTA de imágenes del artículo y se
elige la que parece un escudo por el nombre del archivo, que es lo que haría
uno mirando la página.

    python3 scripts/tools/bajar_faltantes.py
"""
import json, os, re, time, urllib.parse, urllib.request

UA = "olimpia-manager/1.0 (proyecto personal de un hincha; contacto: ivan@blackmont.com.py)"

# Los que quedaron, con el título en los dos idiomas para poder probar en ambos.
PENDIENTES = {
 "corinthians": ["Sport Club Corinthians Paulista"],
 "colo_colo": ["Club Social y Deportivo Colo-Colo", "Colo-Colo"],
 "cobresal": ["Club de Deportes Cobresal", "Cobresal"],
 "ohiggins": ["Club Deportivo O'Higgins", "O'Higgins F.C."],
 "aguilas": ["Águilas Doradas Rionegro", "Águilas Doradas"],
 "ldu": ["Liga Deportiva Universitaria", "L.D.U. Quito"],
 "delfin": ["Delfín Sporting Club", "Delfín S.C."],
 "orense": ["Orense Sporting Club", "Orense S.C."],
 "libertad_ecu": ["Libertad Fútbol Club (Ecuador)", "Libertad F.C. (Ecuador)"],
 "cesar_vallejo": ["Club Universidad César Vallejo", "César Vallejo"],
 "cusco_fc": ["Cusco Fútbol Club", "Cusco FC"],
 "sport_huancayo": ["Club Sport Huancayo", "Sport Huancayo"],
 "real_tomayapo": ["Club Real Tomayapo", "Real Tomayapo"],
 "guabira": ["Club Deportivo Guabirá", "Guabirá"],
 "caracas": ["Caracas Fútbol Club", "Caracas FC"],
 "tachira": ["Deportivo Táchira Fútbol Club", "Deportivo Táchira"],
 "carabobo": ["Carabobo Fútbol Club", "Carabobo FC"],
 "la_guaira": ["Deportivo La Guaira Fútbol Club", "Deportivo La Guaira"],
 "metropolitanos": ["Metropolitanos Fútbol Club", "Metropolitanos FC"],
 "monagas": ["Monagas Sport Club", "Monagas SC"],
 "puerto_cabello": ["Academia Puerto Cabello"],
 "rayo_zuliano": ["Rayo Zuliano"],
}

# Lo que hace que un archivo parezca un escudo y no un mapa ni una foto.
BUENAS = re.compile(r"escudo|logo|crest|badge|shield|emblem|club", re.I)
MALAS  = re.compile(r"map|mapa|estadio|stadium|flag|bandera|commons|wiki|"
                    r"question|edit|folder|ambox|disambig|portal|icon_|"
                    r"symbol_|star|foto|photo|jugador|player|camiseta|kit",
                    re.I)

def pedir(url, binario=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read() if binario else json.loads(r.read())

def candidatos(idioma, titulo):
    api = (f"https://{idioma}.wikipedia.org/w/api.php?action=query&format=json"
           f"&prop=images&imlimit=100&redirects=1&titles="
           + urllib.parse.quote(titulo))
    d = pedir(api)
    salida = []
    for p in d.get("query", {}).get("pages", {}).values():
        for im in p.get("images", []) or []:
            n = im["title"]
            if not re.search(r"\.(png|svg|jpg|jpeg)$", n, re.I): continue
            if MALAS.search(n): continue
            salida.append(n)
    # primero los que se llaman como un escudo
    salida.sort(key=lambda n: (0 if BUENAS.search(n) else 1, len(n)))
    return salida

def urlDeArchivo(idioma, titulo):
    api = (f"https://{idioma}.wikipedia.org/w/api.php?action=query&format=json"
           f"&prop=imageinfo&iiprop=url&titles=" + urllib.parse.quote(titulo))
    d = pedir(api)
    for p in d.get("query", {}).get("pages", {}).values():
        for ii in p.get("imageinfo", []) or []:
            return ii.get("url")
    return None

def main():
    archivos = json.load(open("data/escudos.json"))
    bajados, siguen = [], []

    for cid, titulos in PENDIENTES.items():
        listo = False
        for idioma in ("es", "en"):
            for titulo in titulos:
                try:
                    for archivo in candidatos(idioma, titulo)[:4]:
                        url = urlDeArchivo(idioma, archivo)
                        if not url: continue
                        ext = url.rsplit(".", 1)[-1].lower()
                        if ext not in ("png", "svg", "jpg", "jpeg"): continue
                        datos = pedir(url, binario=True)
                        if len(datos) < 900: continue
                        open(f"public/escudos/{cid}.{ext}", "wb").write(datos)
                        archivos[cid] = ext
                        bajados.append((cid, ext, len(datos), archivo[5:57]))
                        listo = True
                        break
                except Exception:
                    pass
                if listo: break
            if listo: break
        if not listo:
            siguen.append(cid)
        time.sleep(0.25)

    json.dump(dict(sorted(archivos.items())), open("data/escudos.json", "w"),
              indent=1, ensure_ascii=False)
    print(f"\n  bajados: {len(bajados)}   siguen sin escudo: {len(siguen)}\n")
    for cid, ext, n, nombre in bajados:
        print(f"    {cid:20} {ext:4} {n//1024:4} KB  {nombre}")
    if siguen:
        print("\n  sin escudo:", ", ".join(siguen))

if __name__ == "__main__":
    main()
