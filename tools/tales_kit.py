"""Petits outils pour écrire un conte KIBARE (JSON) de façon compacte."""
import json
from pathlib import Path

TALES = Path(__file__).resolve().parent.parent / "content" / "tales"


def it(k, x, y=None, s=None, **extra):
    """Élément d'illustration : clé, position horizontale (%), hauteur, échelle, options (c, flip, a)."""
    d = {"k": k, "x": x}
    if y is not None:
        d["y"] = y
    if s is not None:
        d["s"] = s
    d.update(extra)
    return d


def art(sky, ground, *items):
    return {"sky": sky, "ground": ground, "items": list(items)}


def scene(a, fr, en, choice=None):
    s = {"art": a, "text": {"fr": fr, "en": en}}
    if choice:
        s["choice"] = choice
    return s


def choice(q, options, answer, reveal):
    """q, reveal : (fr, en) ; options : [(fr, en), …]"""
    return {
        "q": {"fr": q[0], "en": q[1]},
        "options": [{"fr": f, "en": e} for f, e in options],
        "answer": answer,
        "reveal": {"fr": reveal[0], "en": reveal[1]},
    }


def quiz(q, options, answer):
    return {"q": {"fr": q[0], "en": q[1]}, "options": [{"fr": f, "en": e} for f, e in options], "answer": answer}


def gloss(term, lang, fr, en):
    return {"term": term, "lang": lang, "def": {"fr": fr, "en": en}}


def tale(num, slug, *, type, region, place, coords, people, language, duration, age, tags, fr, en,
         scenes, quizzes, glossary, source, featured=False, cover=0):
    """fr / en : (titre, sous-titre, résumé, morale) ; source : (fr, en)."""
    t = {
        "slug": slug, "type": type, "region": region, "place": place, "coords": list(coords),
        "people": people, "language": language, "duration": duration, "age": age,
        "featured": featured, "cover": cover, "tags": tags,
        "i18n": {
            "fr": dict(zip(("title", "subtitle", "summary", "moral"), fr)),
            "en": dict(zip(("title", "subtitle", "summary", "moral"), en)),
        },
        "scenes": scenes, "quiz": quizzes, "glossary": glossary,
        "source": {"fr": source[0], "en": source[1]},
    }
    path = TALES / f"{num:02d}-{slug}.json"
    path.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print("✔", path.name)
