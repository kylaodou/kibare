"""Découpage administratif du Burkina Faso après la réforme de juillet 2025 (17 régions, 47 provinces).
usage : tools/.venv/Scripts/python tools/build_geo.py <dossier contenant adm2.geojson et adm3.geojson>"""
import json
import sys
import unicodedata
from pathlib import Path

from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
DATA = ROOT / "yaaba-web" / "public" / "data"
CONTENT = ROOT / "content"


def key(s: str) -> str:
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return "".join(c for c in s if c.isalnum())


# région → (nom officiel, chef-lieu, [(province 2017 dans geoBoundaries, nom 2025, chef-lieu)])
REGIONS = {
    "bankui": ("Bankui", "Dédougou", [("Mouhoun", "Mouhoun", "Dédougou"), ("Bale", "Balé", "Boromo"), ("Banwa", "Banwa", "Solenzo")]),
    "sourou": ("Sourou", "Tougan", [("Kossi", "Kossin", "Nouna"), ("Nayala", "Nayala", "Toma"), ("Sourou", "Sourou", "Tougan")]),
    "guiriko": ("Guiriko", "Bobo-Dioulasso", [("Houet", "Houet", "Bobo-Dioulasso"), ("Kenedougou", "Kénédougou", "Orodara"), ("Tuy", "Tuy", "Houndé")]),
    "tannounyan": ("Tannounyan", "Banfora", [("Comoe", "Comoé", "Banfora"), ("Leraba", "Léraba", "Sindou")]),
    "djoro": ("Djôrô", "Gaoua", [("Bougouriba", "Bougouriba", "Diébougou"), ("Ioba", "Ioba", "Dano"), ("Noumbiel", "Noumbiel", "Batié"), ("Poni", "Poni", "Gaoua")]),
    "yaadga": ("Yaadga", "Ouahigouya", [("Loroum", "Loroum", "Titao"), ("Passore", "Passoré", "Yako"), ("Yatenga", "Yatenga", "Ouahigouya"), ("Zondoma", "Zondoma", "Gourcy")]),
    "nando": ("Nando", "Koudougou", [("Boulkiemde", "Boulkiemdé", "Koudougou"), ("Sanguie", "Sanguié", "Réo"), ("Sissili", "Sissili", "Léo"), ("Ziro", "Ziro", "Sapouy")]),
    "soum": ("Soum", "Djibo", [("Soum", "Djelgodji et Karo-Peli", "Djibo")]),
    "kuilse": ("Kuilsé", "Kaya", [("Bam", "Bam", "Kongoussi"), ("Namentenga", "Namentenga", "Boulsa"), ("Sanmatenga", "Sandbondtenga", "Kaya")]),
    "oubri": ("Oubri", "Ziniaré", [("Oubritenga", "Bassitenga", "Ziniaré"), ("Ganzourgou", "Ganzourgou", "Zorgho"), ("Kourweogo", "Kourwéogo", "Boussé")]),
    "kadiogo": ("Kadiogo", "Ouagadougou", [("Kadiogo", "Kadiogo", "Ouagadougou")]),
    "nazinon": ("Nazinon", "Manga", [("Bazega", "Bazèga", "Kombissiri"), ("Nahouri", "Nahouri", "Pô"), ("Zoundweogo", "Zoundwéogo", "Manga")]),
    "nakambe": ("Nakambé", "Tenkodogo", [("Boulgou", "Boulgou", "Tenkodogo"), ("Koulpelogo", "Koulpélogo", "Ouargaye"), ("Kouritenga", "Kouritenga", "Koupèla")]),
    "liptako": ("Liptako", "Dori", [("Oudalan", "Oudalan", "Gorom-Gorom"), ("Seno", "Séno", "Dori"), ("Yagha", "Yagha", "Sebba")]),
    "goulmou": ("Goulmou", "Fada N'Gourma", [("Gourma", "Gourma", "Fada N'Gourma"), ("Kompienga", "Kompienga", "Pama")]),
    "tapoa": ("Tapoa", "Diapaga", [("Tapoa", "Dyamongou et Gobnangou", "Diapaga")]),
    "sirba": ("Sirba", "Bogandé", [("Gnagna", "Gnagna", "Bogandé"), ("Komonjdjari", "Komondjari", "Gayéri")]),
}

# villes secondaires : chefs-lieux des nouvelles provinces dont la commune porte le nom
EXTRA_TOWNS = {"Arbinda": "soum", "Kantchari": "tapoa"}

# anciennes régions → nouvelles (pour les langues)
OLD_TO_NEW = {
    "boucle-du-mouhoun": ["bankui", "sourou"], "cascades": ["tannounyan"], "centre": ["kadiogo"],
    "centre-est": ["nakambe"], "centre-nord": ["kuilse"], "centre-ouest": ["nando"], "centre-sud": ["nazinon"],
    "est": ["goulmou", "tapoa", "sirba"], "hauts-bassins": ["guiriko"], "nord": ["yaadga"],
    "plateau-central": ["oubri"], "sahel": ["liptako", "soum"], "sud-ouest": ["djoro"],
}

INFO = {
    "bankui": (["Bwaba", "Marka", "Dafing", "Mossi"], ["bwamu", "dioula", "moore"],
               "Traversée par le Mouhoun, le plus grand fleuve du pays, c'est la terre des masques et du FESTIMA de Dédougou.",
               "Crossed by the Mouhoun, the country's largest river, this is the land of masks and of the FESTIMA festival in Dédougou."),
    "sourou": (["Samo", "Marka", "Mossi"], ["dioula", "moore"],
               "La vallée du Sourou, ses terres irriguées et le pays samo de Toma et de Nouna.",
               "The Sourou valley, its irrigated lands and the Samo country of Toma and Nouna."),
    "guiriko": (["Bobo", "Dioula", "Bwaba", "Sénoufo"], ["dioula"],
                "Autour de Bobo-Dioulasso, capitale culturelle du pays, avec sa grande mosquée en banco et la mare de Dafra.",
                "Around Bobo-Dioulasso, the country's cultural capital, with its great mud-brick mosque and the Dafra pond."),
    "tannounyan": (["Karaboro", "Gouin", "Turka", "Sénoufo"], ["dioula"],
                   "Région verdoyante des cascades de Karfiguéla, des pics de Sindou et du lac de Tengréla.",
                   "A green land of the Karfiguéla waterfalls, the Sindou Peaks and Lake Tengréla."),
    "djoro": (["Lobi", "Dagara", "Birifor"], ["lobiri", "dagara"],
              "Pays lobi, de l'or et des ruines de Loropéni, premier site burkinabè inscrit au patrimoine mondial de l'UNESCO.",
              "Lobi country, land of gold and of the Loropéni ruins, Burkina Faso's first UNESCO World Heritage site."),
    "yaadga": (["Mossi", "Peuls"], ["moore", "fulfulde"],
               "Ancien royaume mossi du Yatenga, fondé par Yadéga, aux portes du Sahel.",
               "The former Mossi kingdom of Yatenga, founded by Yadéga, at the gates of the Sahel."),
    "nando": (["Lyela", "Nuni", "Mossi"], ["moore"],
              "Terre des Gourounsi et des Mossi, connue pour la mare aux crocodiles sacrés de Sabou.",
              "Land of the Gurunsi and the Mossi, known for the sacred crocodile pond of Sabou."),
    "soum": (["Peuls", "Kurumba", "Mossi"], ["fulfulde", "moore"],
             "Le Djelgodji, pays peul de Djibo, et les terres kurumba d'Arbinda, aux portes du Sahel.",
             "The Djelgodji, Fulani country around Djibo, and the Kurumba lands of Arbinda, at the gates of the Sahel."),
    "kuilse": (["Mossi", "Peuls"], ["moore", "fulfulde"],
               "Pays de savane et de lacs, comme le lac Bam, où les contes d'animaux animent les veillées.",
               "A land of savannah and lakes, like Lake Bam, where animal tales liven up evening gatherings."),
    "oubri": (["Mossi"], ["moore"],
              "Terre de granite où se trouve le site de sculpture de Laongo ; l'ancien pays de Naaba Oubri.",
              "A granite land home to the Laongo sculpture site; the former country of Naaba Oubri."),
    "kadiogo": (["Mossi"], ["moore"],
                "Cœur politique du pays et du royaume mossi de Ouagadougou, siège de la cour du Moogho Naaba.",
                "The political heart of the country and of the Mossi kingdom of Ouagadougou, seat of the Moogho Naaba's court."),
    "nazinon": (["Kassena", "Nankana", "Mossi"], ["kasem", "moore"],
                "Région des cases peintes de Tiébélé et du ranch de Nazinga, aux confins du Ghana.",
                "Land of the painted houses of Tiébélé and the Nazinga ranch, on the border with Ghana."),
    "nakambe": (["Bissa", "Mossi"], ["bissa", "moore"],
                "Tenkodogo, « la vieille terre », est considérée comme le berceau des royaumes mossi, issus de la descendance de Yennenga.",
                "Tenkodogo, \"the old land\", is seen as the cradle of the Mossi kingdoms descended from Yennenga."),
    "liptako": (["Peuls", "Touaregs", "Sonrhaï", "Bellas"], ["fulfulde"],
                "Pays des dunes, des mares et des grands troupeaux, où l'élevage rythme la vie des Peuls.",
                "A country of dunes, ponds and great herds, where cattle-raising sets the rhythm of Fulani life."),
    "goulmou": (["Gourmantché", "Peuls"], ["gulmancema", "fulfulde"],
                "Le Gulmu, pays des Gourmantché, autour de Fada N'Gourma, la ville du miel et des tissus.",
                "The Gulmu, homeland of the Gourmantché, around Fada N'Gourma, the town of honey and cloth."),
    "tapoa": (["Gourmantché", "Peuls"], ["gulmancema", "fulfulde"],
              "Pays de Diapaga et des parcs W et d'Arly, grandes réserves de faune classées au patrimoine mondial.",
              "The country of Diapaga and of the W and Arly parks, great wildlife reserves on the World Heritage list."),
    "sirba": (["Gourmantché", "Peuls"], ["gulmancema", "fulfulde"],
              "La Gnagna et la Komondjari, terres de la Sirba autour de Bogandé, où vivent Gourmantché et Peuls.",
              "Gnagna and Komondjari, the Sirba lands around Bogandé, home to the Gourmantché and the Fulani."),
}


def round_geom(g, nd=4):
    def r(c):
        return [r(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], nd), round(c[1], nd)]
    m = mapping(g)
    return {"type": m["type"], "coordinates": r(m["coordinates"])}


adm2 = json.loads((SRC / "adm2.geojson").read_text("utf-8"))
adm3 = json.loads((SRC / "adm3.geojson").read_text("utf-8"))
provs = {key(f["properties"]["shapeName"]): shape(f["geometry"]).buffer(0) for f in adm2["features"]}

region_feats, prov_feats, region_geoms, prov_index = [], [], {}, []
for code, (name, capital, plist) in REGIONS.items():
    geoms = []
    for old, new, chef in plist:
        g = provs[key(old)]
        geoms.append(g)
        prov_index.append((g, new, code))
        prov_feats.append({"type": "Feature", "properties": {"name": new, "region": code, "capital": chef},
                           "geometry": round_geom(g.simplify(0.004))})
    rg = unary_union(geoms).buffer(0)
    region_geoms[code] = rg
    region_feats.append({"type": "Feature", "properties": {"code": code, "name": name},
                         "geometry": round_geom(rg.simplify(0.003))})

assert len(provs) == sum(len(p[2]) for p in REGIONS.values()), "province oubliée"

# communes : rattachées à leur province et à leur région par leur point représentatif
commune_feats, commune_pts = [], {}
for f in adm3["features"]:
    g = shape(f["geometry"]).buffer(0)
    pt = g.representative_point()
    prov = next(((n, c) for pg, n, c in prov_index if pg.contains(pt)), None)
    if not prov:
        prov = min(((n, c) for pg, n, c in prov_index), key=lambda nc: next(pg for pg, n, c in prov_index if n == nc[0]).distance(pt))
    name = f["properties"]["shapeName"]
    commune_pts[key(name)] = (pt, prov[1])
    commune_feats.append({"type": "Feature", "properties": {"name": name, "province": prov[0], "region": prov[1]},
                          "geometry": round_geom(g.simplify(0.003))})

# villes : chefs-lieux de région et de province (latitude, longitude)
TOWN_COORDS = {
    "Dédougou": (12.46, -3.46), "Boromo": (11.75, -2.93), "Solenzo": (12.18, -4.08), "Nouna": (12.73, -3.86),
    "Toma": (12.76, -2.89), "Tougan": (13.07, -3.07), "Bobo-Dioulasso": (11.18, -4.30), "Orodara": (10.98, -4.91),
    "Houndé": (11.50, -3.52), "Banfora": (10.63, -4.76), "Sindou": (10.67, -5.17), "Diébougou": (10.97, -3.25),
    "Dano": (11.15, -3.06), "Batié": (9.88, -2.92), "Gaoua": (10.33, -3.18), "Titao": (13.77, -2.07),
    "Yako": (12.96, -2.26), "Ouahigouya": (13.58, -2.42), "Gourcy": (13.21, -2.36), "Koudougou": (12.25, -2.36),
    "Réo": (12.32, -2.47), "Léo": (11.10, -2.10), "Sapouy": (11.55, -1.77), "Djibo": (14.10, -1.63),
    "Arbinda": (14.23, -0.87), "Kongoussi": (13.33, -1.53), "Boulsa": (12.66, -0.57), "Kaya": (13.09, -1.08),
    "Ziniaré": (12.58, -1.30), "Zorgho": (12.25, -0.62), "Boussé": (12.66, -1.89), "Ouagadougou": (12.37, -1.52),
    "Kombissiri": (12.07, -1.34), "Pô": (11.17, -1.15), "Manga": (11.66, -1.07), "Tenkodogo": (11.78, -0.37),
    "Ouargaye": (11.53, 0.05), "Koupèla": (12.18, -0.35), "Gorom-Gorom": (14.44, -0.24), "Dori": (14.03, -0.03),
    "Sebba": (13.44, 0.53), "Fada N'Gourma": (12.06, 0.36), "Pama": (11.25, 0.70), "Kantchari": (12.48, 1.52),
    "Diapaga": (12.07, 1.79), "Bogandé": (12.97, -0.14), "Gayéri": (12.65, 0.49),
}
towns = {}
for code, (name, capital, plist) in REGIONS.items():
    for _, prov_name, chef in plist:
        towns.setdefault(chef, {"name": chef, "region": code, "rank": "province"})
    towns[capital] = {"name": capital, "region": code, "rank": "region"}
for t, code in EXTRA_TOWNS.items():
    towns.setdefault(t, {"name": t, "region": code, "rank": "province"})
cities = []
for t in towns.values():
    lat, lon = TOWN_COORDS[t["name"]]
    cities.append({**t, "coords": [lat, lon]})

DATA.mkdir(parents=True, exist_ok=True)
(DATA / "regions.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": region_feats}, ensure_ascii=False), "utf-8")
(DATA / "provinces.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": prov_feats}, ensure_ascii=False), "utf-8")
(DATA / "communes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": commune_feats}, ensure_ascii=False), "utf-8")
(DATA / "cities.json").write_text(json.dumps(cities, ensure_ascii=False), "utf-8")

# fiches régions
regions_json = []
for code, (name, capital, plist) in REGIONS.items():
    peoples, langs, fr, en = INFO[code]
    c = region_geoms[code].representative_point()
    regions_json.append({
        "code": code, "name": name, "capital": capital, "center": [round(c.y, 2), round(c.x, 2)],
        "provinces": [p[1] for p in plist], "peoples": peoples, "languages": langs,
        "description": {"fr": fr, "en": en},
    })
regions_json.sort(key=lambda r: key(r["name"]))
(CONTENT / "regions.json").write_text(json.dumps(regions_json, ensure_ascii=False, indent=2) + "\n", "utf-8")

# contes : nouvelle région d'après leurs coordonnées
for p in sorted((CONTENT / "tales").glob("*.json")):
    t = json.loads(p.read_text("utf-8"))
    pt = Point(t["coords"][1], t["coords"][0])
    code = next((c for c, g in region_geoms.items() if g.contains(pt)), None) or min(region_geoms, key=lambda c: region_geoms[c].distance(pt))
    if t.get("region") != code:
        print(f"{t['slug']}: {t.get('region')} → {code}")
        t["region"] = code
        p.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", "utf-8")

# langues : régions où elles sont parlées
langs_path = CONTENT / "languages.json"
langs = json.loads(langs_path.read_text("utf-8"))
for l in langs:
    if "regions" in l:
        new = []
        for r in l["regions"]:
            for n in OLD_TO_NEW.get(r, [r]):
                if n not in new:
                    new.append(n)
        l["regions"] = new
langs_path.write_text(json.dumps(langs, ensure_ascii=False, indent=2) + "\n", "utf-8")

print(f"{len(region_feats)} régions, {len(prov_feats)} provinces, {len(commune_feats)} communes, {len(cities)} villes")
