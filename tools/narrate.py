"""Narration audio des contes, un MP3 par paragraphe.
usage : tools/.venv/Scripts/python tools/narrate.py fr en [moore dioula fulfulde] [--only slug]"""
import asyncio
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TALES = ROOT / "content" / "tales"
OUT = ROOT / "yaaba-web" / "public" / "audio" / "narration"
EDGE = {"fr": ("fr-FR-HenriNeural", "-8%"), "en": ("en-NG-AbeoNeural", "-6%")}
MMS = {"moore": "facebook/mms-tts-mos", "dioula": "facebook/mms-tts-dyu", "fulfulde": "facebook/mms-tts-ful"}


def to_mp3(src: Path, dst: Path, rate: int | None = None):
    dst.parent.mkdir(parents=True, exist_ok=True)
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    if rate:
        args += ["-f", "f32le", "-ar", str(rate), "-ac", "1"]
    args += ["-i", str(src), "-ac", "1", "-ar", "24000", "-b:a", "40k", str(dst)]
    subprocess.run(args, check=True)


async def edge(text: str, lang: str, dst: Path):
    import edge_tts

    voice, rate = EDGE[lang]
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "a.mp3"
        await edge_tts.Communicate(text, voice, rate=rate).save(str(raw))
        to_mp3(raw, dst)


class Mms:
    def __init__(self, lang: str):
        import torch
        from transformers import AutoTokenizer, VitsModel

        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(MMS[lang])
        self.model = VitsModel.from_pretrained(MMS[lang]).eval()
        self.model.speaking_rate = 0.92

    def say(self, text: str, dst: Path):
        import re

        parts = [p for p in re.split(r"(?<=[.!?…])\s+", text) if p.strip()]
        pause = self.torch.zeros(int(0.35 * self.model.config.sampling_rate))
        waves = []
        for p in parts:
            enc = self.tok(p, return_tensors="pt")
            if enc["input_ids"].shape[1] < 2:
                continue
            with self.torch.no_grad():
                waves += [self.model(**enc).waveform[0], pause]
        if not waves:
            return
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "a.f32"
            raw.write_bytes(self.torch.cat(waves).numpy().astype("float32").tobytes())
            to_mp3(raw, dst, self.model.config.sampling_rate)


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1] if "--only" in args else None
    langs = [a for a in args if a in EDGE or a in MMS]
    tales = [json.loads(p.read_text("utf-8")) for p in sorted(TALES.glob("*.json"))]
    for lang in langs:
        engine = Mms(lang) if lang in MMS else None
        for t in tales:
            if only and only not in t["slug"]:
                continue
            texts = [s["text"].get(lang) for s in t["scenes"]]
            if not all(texts):
                continue
            for i, text in enumerate(texts):
                dst = OUT / t["slug"] / lang / f"{i}.mp3"
                if dst.exists():
                    continue
                for attempt in range(3):
                    try:
                        if engine:
                            engine.say(text, dst)
                        else:
                            asyncio.run(edge(text, lang, dst))
                        break
                    except Exception as e:  # réseau Edge capricieux
                        print(f"  ! {t['slug']} {lang} {i}: {e}", flush=True)
            print(f"{lang} {t['slug']}", flush=True)


if __name__ == "__main__":
    main()
