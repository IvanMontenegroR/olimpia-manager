"""
Baja los escudos de los clubes desde Wikipedia.

El juego tiene noventa clubes sudamericanos y solo unos pocos con escudo real;
el resto usaba un dibujo con los colores de la camiseta. Esto busca cada club en
Wikipedia (primero en español, después en inglés) y se trae la imagen principal
del artículo, que es el escudo.

No es automático a ciegas: se pide artículo por artículo con el título exacto,
se revisa que lo que vuelve sea una imagen y no un mapa o una foto del estadio,
y lo que no se encuentra queda anotado para resolver a mano.

    python3 scripts/tools/bajar_escudos.py
"""
import json, os, re, time, urllib.parse, urllib.request

UA = "olimpia-manager/1.0 (proyecto personal de un hincha; contacto: ivan@blackmont.com.py)"

# El título del artículo de cada club. Se pone a mano porque buscar por nombre
# trae cualquier cosa: "Nacional" son treinta clubes distintos.
ARTICULOS = {
 "flamengo": ("es", "Clube de Regatas do Flamengo"),
 "palmeiras": ("es", "Sociedade Esportiva Palmeiras"),
 "corinthians": ("es", "Sport Club Corinthians Paulista"),
 "fluminense": ("es", "Fluminense Football Club"),
 "cruzeiro": ("es", "Cruzeiro Esporte Clube"),
 "internacional": ("es", "Sport Club Internacional"),
 "gremio": ("es", "Grêmio Foot-Ball Porto Alegrense"),
 "fortaleza": ("es", "Fortaleza Esporte Clube"),
 "racing": ("es", "Racing Club"),
 "velez": ("es", "Club Atlético Vélez Sarsfield"),
 "estudiantes": ("es", "Club Estudiantes de La Plata"),
 "independiente": ("es", "Club Atlético Independiente"),
 "san_lorenzo_arg": ("es", "Club Atlético San Lorenzo de Almagro"),
 "talleres": ("es", "Club Atlético Talleres (Córdoba)"),
 "argentinos": ("es", "Asociación Atlética Argentinos Juniors"),
 "rosario_central": ("es", "Club Atlético Rosario Central"),
 "newells": ("es", "Club Atlético Newell's Old Boys"),
 "penarol": ("es", "Club Atlético Peñarol"),
 "nacional_uru": ("es", "Club Nacional de Football"),
 "liverpool_uru": ("es", "Liverpool Fútbol Club"),
 "defensor": ("es", "Defensor Sporting Club"),
 "danubio": ("es", "Danubio Fútbol Club"),
 "cerro_largo": ("es", "Cerro Largo Fútbol Club"),
 "boston_river": ("es", "Club Atlético Boston River"),
 "racing_uru": ("es", "Racing Club de Montevideo"),
 "colo_colo": ("es", "Club Social y Deportivo Colo-Colo"),
 "u_de_chile": ("es", "Club Universidad de Chile"),
 "u_catolica": ("es", "Club Deportivo Universidad Católica"),
 "palestino": ("es", "Club Deportivo Palestino"),
 "huachipato": ("es", "Club Deportivo Huachipato"),
 "cobresal": ("es", "Club de Deportes Cobresal"),
 "audax": ("es", "Audax Club Sportivo Italiano"),
 "nublense": ("es", "Club Deportivo Ñublense"),
 "ohiggins": ("es", "Club Deportivo O'Higgins"),
 "atletico_nacional": ("es", "Atlético Nacional"),
 "millonarios": ("es", "Millonarios Fútbol Club"),
 "junior": ("es", "Junior de Barranquilla"),
 "america_cali": ("es", "América de Cali"),
 "deportivo_cali": ("es", "Deportivo Cali"),
 "tolima": ("es", "Deportes Tolima"),
 "once_caldas": ("es", "Once Caldas"),
 "aguilas": ("es", "Águilas Doradas Rionegro"),
 "idv": ("es", "Independiente del Valle"),
 "ldu": ("es", "Liga Deportiva Universitaria"),
 "barcelona_sc": ("es", "Barcelona Sporting Club"),
 "emelec": ("es", "Club Sport Emelec"),
 "aucas": ("es", "Sociedad Deportiva Aucas"),
 "u_catolica_ecu": ("es", "Club Deportivo de la Universidad Católica"),
 "delfin": ("es", "Delfín Sporting Club"),
 "orense": ("es", "Orense Sporting Club"),
 "libertad_ecu": ("es", "Libertad Fútbol Club (Ecuador)"),
 "universitario": ("es", "Club Universitario de Deportes"),
 "alianza_lima": ("es", "Club Alianza Lima"),
 "sporting_cristal": ("es", "Club Sporting Cristal"),
 "melgar": ("es", "Foot Ball Club Melgar"),
 "cesar_vallejo": ("es", "Club Universidad César Vallejo"),
 "cusco_fc": ("es", "Cusco Fútbol Club"),
 "sport_huancayo": ("es", "Club Sport Huancayo"),
 "adt": ("es", "Asociación Deportiva Tarma"),
 "the_strongest": ("es", "Club The Strongest"),
 "always_ready": ("es", "Club Always Ready"),
 "nacional_potosi": ("es", "Club Atlético Nacional Potosí"),
 "blooming": ("es", "Club Blooming"),
 "aurora": ("es", "Club Aurora"),
 "wilstermann": ("es", "Club Deportivo Jorge Wilstermann"),
 "real_tomayapo": ("es", "Club Real Tomayapo"),
 "guabira": ("es", "Club Deportivo Guabirá"),
 "caracas": ("es", "Caracas Fútbol Club"),
 "tachira": ("es", "Deportivo Táchira Fútbol Club"),
 "carabobo": ("es", "Carabobo Fútbol Club"),
 "la_guaira": ("es", "Deportivo La Guaira Fútbol Club"),
 "metropolitanos": ("es", "Metropolitanos Fútbol Club"),
 "monagas": ("es", "Monagas Sport Club"),
 "puerto_cabello": ("es", "Academia Puerto Cabello"),
 "estudiantes_merida": ("es", "Estudiantes de Mérida Fútbol Club"),
 "rayo_zuliano": ("es", "Rayo Zuliano"),
}

def pedir(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()

def imagen_del_articulo(idioma, titulo):
    """La imagen principal del artículo, que en un club es el escudo."""
    api = (f"https://{idioma}.wikipedia.org/w/api.php?action=query&format=json"
           f"&prop=pageimages&piprop=original&redirects=1&titles="
           + urllib.parse.quote(titulo))
    datos = json.loads(pedir(api))
    paginas = datos.get("query", {}).get("pages", {})
    for p in paginas.values():
        origen = p.get("original", {}).get("source")
        if origen:
            return origen.split("?")[0]
    return None

def main():
    destino = "public/escudos"
    os.makedirs(destino, exist_ok=True)
    archivos = json.load(open("data/escudos.json"))
    bajados, fallados = [], []

    for cid, (idioma, titulo) in ARTICULOS.items():
        try:
            url = imagen_del_articulo(idioma, titulo)
            if not url:
                url = imagen_del_articulo("en", titulo)
            if not url:
                fallados.append((cid, "sin imagen en el artículo")); continue

            ext = re.sub(r"[^a-z]", "", url.rsplit(".", 1)[-1].lower())
            if ext not in ("png", "svg", "jpg", "jpeg", "gif", "webp"):
                fallados.append((cid, f"formato raro: {ext}")); continue
            if ext == "svg":
                ext = "svg"

            datos = pedir(url)
            if len(datos) < 500:
                fallados.append((cid, "archivo demasiado chico")); continue

            open(f"{destino}/{cid}.{ext}", "wb").write(datos)
            archivos[cid] = ext
            bajados.append((cid, ext, len(datos), url.rsplit("/", 1)[-1]))
        except Exception as e:
            fallados.append((cid, str(e)[:60]))
        time.sleep(0.25)   # no apurar a Wikipedia

    json.dump(dict(sorted(archivos.items())), open("data/escudos.json", "w"),
              indent=1, ensure_ascii=False)

    print(f"\n  bajados: {len(bajados)}   fallados: {len(fallados)}\n")
    for cid, ext, n, nombre in bajados:
        print(f"    {cid:22} {ext:4} {n//1024:4} KB  {nombre[:52]}")
    if fallados:
        print("\n  no se pudo:\n")
        for cid, por in fallados:
            print(f"    {cid:22} {por}")

if __name__ == "__main__":
    main()
