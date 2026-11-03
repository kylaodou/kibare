"""Ajoute aux illustrations les personnages et animaux nommés dans le texte mais absents de l'image.
usage : python tools/fix_art.py [premier numéro] [dernier numéro]"""
import json
import re
import sys
from pathlib import Path

TALES = Path(__file__).resolve().parent.parent / "content" / "tales"
ART = r"(?:^|[^a-zà-ÿ'])(?:le|la|les|un|une|des|du|au|aux|l')\s*"

# mot → (élément à ajouter, éléments qui le représentent déjà, échelle)
ACTORS = {
    "lion": ("lion", {"lion"}, 0.8), "hyène": ("hyena", {"hyena"}, 0.9), "lièvre": ("hare", {"hare"}, 1),
    "éléphant": ("elephant", {"elephant"}, 0.7), "crocodile": ("croc", {"croc", "crocodile"}, 1),
    "tortue": ("tortoise", {"tortoise"}, 1.2), "serpent": ("snake", {"snake"}, 1), "singe": ("monkey", {"monkey"}, 0.9),
    "chien": ("dog", {"dog"}, 1), "chacal": ("dog", {"dog"}, 1), "vache": ("cow", {"cow", "wild-cow"}, 0.9),
    "chèvre": ("goat", {"goat"}, 0.9), "bouc": ("goat", {"goat"}, 0.9), "perdrix": ("partridge", {"partridge"}, 1.1),
    "souris": ("mouse", {"mouse"}, 1.4), "antilope": ("antelope", {"antelope"}, 1), "biche": ("antelope", {"antelope"}, 1),
    "hippopotame": ("hippo", {"hippo"}, 0.8), "pintade": ("guinea-fowl", {"guinea-fowl"}, 1.2), "hibou": ("owl", {"owl"}, 1.2),
    "poule": ("chicken", {"chicken"}, 1), "coq": ("chicken", {"chicken"}, 1),
    "roi": ("king", {"king", "king-talk"}, 1), "chef": ("king", {"king", "king-talk", "elder", "elder-sit"}, 1),
    "femme": ("woman", {"woman", "woman-talk", "woman-up", "woman-pound", "princess", "old-woman"}, 1),
    "mère": ("woman", {"woman", "woman-talk", "woman-up", "woman-pound", "princess", "old-woman"}, 1),
    "enfant": ("child", {"child", "child-up", "child-sit"}, 1), "garçon": ("child", {"child", "child-up", "child-sit"}, 1),
    "vieillard": ("elder", {"elder", "elder-sit", "yaaba-sit"}, 1), "chasseur": ("hunter", {"hunter"}, 1),
}
GROUND_ITEMS = None  # tout élément sans hauteur explicite est au sol


def free_x(items):
    """Position horizontale la plus éloignée des éléments déjà au sol."""
    taken = [it["x"] for it in items if (it.get("y") or 0) < 60]
    best, gap = 50, -1
    for x in range(12, 90, 2):
        d = min((abs(x - t) for t in taken), default=100)
        if d > gap:
            best, gap = x, d
    return best


def fix(path: Path) -> int:
    t = json.loads(path.read_text("utf-8"))
    added = 0
    for scene in t["scenes"]:
        items = scene["art"]["items"]
        text = scene["text"]["fr"].lower()
        keys = {it["k"] for it in items}
        for word, (k, present, s) in ACTORS.items():
            if len(items) >= 7 or keys & present:
                continue
            if re.search(ART + word, text):
                x = free_x(items)
                item = {"k": k, "x": x}
                if s != 1:
                    item["s"] = s
                if x > 50:
                    item["flip"] = True
                items.append(item)
                keys.add(k)
                added += 1
    if added:
        path.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", "utf-8")
    return added


if __name__ == "__main__":
    lo, hi = (int(a) for a in sys.argv[1:3]) if len(sys.argv) > 2 else (1, 999)
    total = 0
    for p in sorted(TALES.glob("*.json")):
        n = int(p.name[:2])
        if lo <= n <= hi:
            a = fix(p)
            if a:
                print(f"{p.name}: +{a}")
            total += a
    print(f"{total} éléments ajoutés")
