"""Traduction automatique des contes vers le mooré, le dioula et le fulfulde (NLLB-200).
usage : tools/.venv/Scripts/python tools/translate.py [slug ...]"""
import json
import re
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ROOT = Path(__file__).resolve().parent.parent
TALES = ROOT / "content" / "tales"
CACHE = Path(__file__).with_name("mt-cache.json")
MODEL = "facebook/nllb-200-distilled-600M"
TARGETS = {"moore": "mos_Latn", "dioula": "dyu_Latn", "fulfulde": "fuv_Latn"}

torch.set_num_threads(max(1, torch.get_num_threads()))
tok = AutoTokenizer.from_pretrained(MODEL, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL).eval()
cache: dict[str, str] = json.loads(CACHE.read_text("utf-8")) if CACHE.exists() else {}


def sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?…])\s+", text.strip()) if s]


def translate_batch(items: list[str], code: str) -> list[str]:
    todo = [s for s in dict.fromkeys(items) if f"{code}|{s}" not in cache]
    for i in range(0, len(todo), 12):
        chunk = todo[i : i + 12]
        enc = tok(chunk, return_tensors="pt", padding=True, truncation=True, max_length=256)
        with torch.no_grad():
            out = model.generate(
                **enc,
                forced_bos_token_id=tok.convert_tokens_to_ids(code),
                max_new_tokens=256,
                num_beams=1,
                no_repeat_ngram_size=4,
                repetition_penalty=1.15,
            )
        for src, dst in zip(chunk, tok.batch_decode(out, skip_special_tokens=True)):
            cache[f"{code}|{src}"] = dst
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), "utf-8")
    return [cache[f"{code}|{s}"] for s in items]


def collect(t: dict) -> list[tuple[dict, str]]:
    """Tous les objets {fr, en, …} à traduire, avec la clé de langue cible."""
    objs = []
    for sc in t["scenes"]:
        objs.append(sc["text"])
        ch = sc.get("choice")
        if ch:
            objs += [ch["q"], ch["reveal"], *ch["options"]]
    for q in t.get("quiz", []):
        objs += [q["q"], *q["options"]]
    for g in t.get("glossary", []):
        objs.append(g["def"])
    return objs


def run(path: Path):
    t = json.loads(path.read_text("utf-8"))
    mt = set(t.get("mt", []))
    for lang, code in TARGETS.items():
        if lang in t["i18n"] and lang not in mt:
            continue  # version humaine
        objs = [o for o in collect(t) if o.get("en")]
        head = t["i18n"]["en"]
        fields = [k for k in ("title", "subtitle", "summary", "moral") if head.get(k)]
        # une phrase par segment, puis on réassemble
        segs, plan = [], []
        for o in objs:
            ss = sentences(o["en"])
            plan.append((o, len(ss)))
            segs += ss
        for k in fields:
            ss = sentences(head[k])
            plan.append((k, len(ss)))
            segs += ss
        out = translate_batch(segs, code)
        pos, tx = 0, {}
        for target, n in plan:
            text = " ".join(out[pos : pos + n])
            pos += n
            if isinstance(target, dict):
                target[lang] = text
            else:
                tx[target] = text
        t["i18n"][lang] = tx
        mt.add(lang)
        print(f"  {t['slug']} → {lang}", flush=True)
    t["mt"] = sorted(mt)
    path.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", "utf-8")


# NLLB a beaucoup appris sur des textes bibliques : ces mots surgissent hors de propos.
RELIGIOUS = ["Jehova", "Jehovah", "Zezi", "Yesu", "Yezu", "Jesus", "Jezu", "Kirisi", "Kiristo", "Biible", "Bible", "Wẽnnaam", "Ala", "Allah", "Isa", "Masiya"]


def repair():
    """Retraduit les segments contaminés en interdisant ces mots (recherche en faisceau)."""
    bad = [tok(w, add_special_tokens=False).input_ids for w in RELIGIOUS]
    bad += [tok(" " + w, add_special_tokens=False).input_ids for w in RELIGIOUS]
    bad = [b for b in bad if b]
    pattern = re.compile(r"\b(" + "|".join(map(re.escape, RELIGIOUS)) + r")", re.I)
    divine = re.compile(r"(God|Creator|Lord|heaven|pray)", re.I)
    keys = [k for k, v in cache.items() if pattern.search(v) and not divine.search(k)]
    print(f"{len(keys)} segments à réparer", flush=True)
    for k in keys:
        code, src = k.split("|", 1)
        enc = tok([src], return_tensors="pt", truncation=True, max_length=256)
        with torch.no_grad():
            out = model.generate(
                **enc,
                forced_bos_token_id=tok.convert_tokens_to_ids(code),
                max_new_tokens=256,
                num_beams=4,
                no_repeat_ngram_size=4,
                bad_words_ids=bad,
            )
        cache[k] = tok.batch_decode(out, skip_special_tokens=True)[0]
        print(f"  {cache[k][:100]}", flush=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), "utf-8")


if __name__ == "__main__":
    if sys.argv[1:] == ["--repair"]:
        repair()
        sys.argv = sys.argv[:1]
    only = set(sys.argv[1:])
    for p in sorted(TALES.glob("*.json")):
        if only and not any(s in p.name for s in only):
            continue
        print(p.name, flush=True)
        run(p)
