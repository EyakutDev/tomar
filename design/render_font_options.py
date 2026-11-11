from pathlib import Path
from tempfile import gettempdir

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
PACKAGE_ROOT = Path.home() / "AppData" / "Local" / "Temp" / "merak-font-preview" / "node_modules" / "@fontsource-variable"
FONT_OUT = Path(gettempdir()) / "merak-font-converted"
FONT_OUT.mkdir(parents=True, exist_ok=True)

FAMILIES = [
    ("source-serif-4", "Source Serif 4", "Sakin ve dengeli"),
    ("literata", "Literata", "Kitap hissi güçlü"),
    ("newsreader", "Newsreader", "Çağdaş ve editoryal"),
]

PASSAGE = (
    "Sabahın ilk vapurunda herkes bir yere yetişiyordu. Yaşlı adam camın "
    "önüne oturmuş, kıyıdaki evleri tek tek sayıyordu. Karşı yakaya varınca "
    "yerinden kalkmadı. Yolculuk bitmişti; onun acelesi yoktu."
)

UI = ImageFont.truetype("C:/Windows/Fonts/corbel.ttf", 28)
UI_SMALL = ImageFont.truetype("C:/Windows/Fonts/corbel.ttf", 24)
UI_TITLE = ImageFont.truetype("C:/Windows/Fonts/corbel.ttf", 43)
UI_LOGO = ImageFont.truetype("C:/Windows/Fonts/corbel.ttf", 55)


def load_font(family: str, subset: str, size: int):
    source = PACKAGE_ROOT / family / "files" / f"{family}-{subset}-wght-normal.woff2"
    target = FONT_OUT / f"{family}-{subset}.ttf"
    if not target.exists():
        font = TTFont(source)
        font.flavor = None
        font.save(target)
    return ImageFont.truetype(str(target), size), set(TTFont(target).getBestCmap())


def runs(value, regular, extended, regular_chars, extended_chars):
    result = []
    for char in value:
        face = extended if ord(char) not in regular_chars and ord(char) in extended_chars else regular
        if result and result[-1][0] is face:
            result[-1] = (face, result[-1][1] + char)
        else:
            result.append((face, char))
    return result


def width(value, regular, extended, regular_chars, extended_chars):
    return sum(face.getlength(part) for face, part in runs(value, regular, extended, regular_chars, extended_chars))


def wrap(value, max_width, regular, extended, regular_chars, extended_chars):
    lines, current = [], ""
    for word in value.split():
        candidate = f"{current} {word}" if current else word
        if current and width(candidate, regular, extended, regular_chars, extended_chars) > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_mixed(draw, x, baseline, value, color, regular, extended, regular_chars, extended_chars):
    for face, part in runs(value, regular, extended, regular_chars, extended_chars):
        draw.text((x, baseline), part, font=face, fill=color, anchor="ls")
        x += face.getlength(part)


W, H = 2250, 1320
CARD_W, CARD_H = 700, 1090
BG, PAPER, INK, MUTED, RULE, ACCENT = "#e4e7e1", "#fbfaf7", "#252b27", "#6d746e", "#d8ddd6", "#957b66"
canvas = Image.new("RGB", (W, H), BG)
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
for index in range(3):
    x = 50 + index * 725
    sd.rounded_rectangle((x + 4, 157, x + CARD_W + 4, 150 + CARD_H + 13), 42, fill=(34, 44, 37, 42))
canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(24)))
d = ImageDraw.Draw(canvas)
d.text((52, 45), "MERAK  /  PASAJ YAZISI", font=UI, fill=MUTED)
d.text((2195, 49), "Aynı metin, üç yazı tipi", font=UI_SMALL, fill=MUTED, anchor="ra")

for index, (family, label, subtitle) in enumerate(FAMILIES):
    x, y = 50 + index * 725, 150
    d.rounded_rectangle((x, y, x + CARD_W, y + CARD_H), 42, fill=PAPER)
    d.text((x + 46, y + 41), label, font=UI_TITLE, fill=INK)
    d.text((x + 47, y + 100), subtitle, font=UI_SMALL, fill=MUTED)
    d.line((x + 46, y + 149, x + CARD_W - 46, y + 149), fill=RULE, width=2)
    d.text((x + 46, y + 180), "merak", font=UI_LOGO, fill=INK)
    d.text((x + 48, y + 295), "Bir okurun seçkisi", font=UI_SMALL, fill=MUTED)
    d.line((x + 47, y + 342, x + 47, y + 893), fill=ACCENT, width=3)

    normal, normal_chars = load_font(family, "latin", 38)
    ext, ext_chars = load_font(family, "latin-ext", 38)
    lines = wrap(PASSAGE, CARD_W - 130, normal, ext, normal_chars, ext_chars)
    baseline = y + 394
    for line in lines:
        draw_mixed(d, x + 72, baseline, line, INK, normal, ext, normal_chars, ext_chars)
        baseline += 58

    d.line((x + 46, y + 933, x + CARD_W - 46, y + 933), fill=RULE, width=2)
    d.text((x + 46, y + 963), "Kaynak", font=UI_SMALL, fill=ACCENT)
    d.text((x + 46, y + 1001), "Merak için yazılmış örnek metin", font=UI, fill=INK)
    d.text((x + 46, y + 1038), "Merak ekibi", font=UI_SMALL, fill=MUTED)

    individual = canvas.crop((x - 10, y - 10, x + CARD_W + 10, y + CARD_H + 20)).convert("RGB")
    individual.save(ROOT / f"font-{index + 1}-{family}.png", optimize=True)

canvas.convert("RGB").save(ROOT / "font-karsilastirma.png", optimize=True)
