"""Images des e-mails KIBARE (intégrées aux messages, donc visibles dans Gmail sans serveur public).
usage : python tools/build_mail_art.py"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "yaaba-api" / "src" / "main" / "resources" / "mail"
LOGO = ROOT / "yaaba-web" / "public" / "brand" / "kibare-logo.png"

BROWN = (124, 49, 9)
OCHRE = (230, 145, 53)
YELLOW = (251, 177, 23)
DARK = (43, 21, 8)
W = 1120  # affiché en 560 px (écrans haute densité)


def bogolan(draw: ImageDraw.ImageDraw, w: int, h: int, color, tile=240, width=5):
    """Motif « bogolan » du site (traits, cercles, losanges, vagues, zigzags), répété en mosaïque."""
    for oy in range(0, h, tile):
        for ox in range(0, w, tile):
            def p(x, y):
                return ox + x * 2, oy + y * 2
            for y in (10, 18, 26):
                draw.line([p(10, y), p(30, y)], fill=color, width=width)
            cx, cy = p(80, 20)
            draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], outline=color, width=width)
            draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=color)
            draw.polygon([p(50, 60), p(60, 50), p(70, 60), p(60, 70)], outline=color, width=width)
            draw.line([p(95, 75), p(95, 105)], fill=color, width=width)
            draw.line([p(105, 75), p(105, 105)], fill=color, width=width)
            draw.arc([*p(12, 72), *p(28, 88)], 180, 360, fill=color, width=width)
            draw.arc([*p(28, 72), *p(44, 88)], 0, 180, fill=color, width=width)
            draw.line([p(20, 100), p(26, 108), p(32, 100), p(38, 108)], fill=color, width=width, joint="curve")


def header():
    h = 330
    img = Image.new("RGBA", (W, h), (255, 255, 255, 255))
    layer = Image.new("RGBA", (W, h), (0, 0, 0, 0))
    bogolan(ImageDraw.Draw(layer), W, h, BROWN + (26,))
    img.alpha_composite(layer)
    logo = Image.open(LOGO).convert("RGBA")
    lh = 270
    logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
    # halo blanc derrière le logo pour qu'il reste net sur les motifs
    halo = Image.new("RGBA", (W, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    x0, y0 = (W - logo.width) // 2, (h - lh) // 2
    hd.rounded_rectangle([x0 - 30, y0 - 10, x0 + logo.width + 30, y0 + lh + 10], 40, fill=(255, 255, 255, 235))
    img.alpha_composite(halo)
    img.alpha_composite(logo, (x0, y0))
    img.convert("RGB").quantize(64).save(OUT / "header.png", optimize=True)


def footer():
    h = 120
    img = Image.new("RGBA", (W, h), DARK + (255,))
    d = ImageDraw.Draw(img)
    # rangée de triangles (comme la frise du site), alternance ocre / jaune
    t = 28
    for i, x in enumerate(range(0, W + t, t)):
        d.polygon([(x, 0), (x + t, 0), (x + t / 2, 22)], fill=OCHRE if i % 2 == 0 else YELLOW)
    layer = Image.new("RGBA", (W, h), (0, 0, 0, 0))
    bogolan(ImageDraw.Draw(layer), W, h, OCHRE + (70,), tile=240, width=4)
    img.alpha_composite(layer, (0, 30))
    img.convert("RGB").quantize(64).save(OUT / "footer.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    header()
    footer()
    for f in ("header.png", "footer.png"):
        print(f, (OUT / f).stat().st_size // 1024, "Ko")
