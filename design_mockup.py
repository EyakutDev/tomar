from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
OUT = HERE / "design"
OUT.mkdir(exist_ok=True)

W, H = 1080, 1920
PAPER = "#F5F2EB"
INK = "#25241F"
MUTED = "#746E64"
ACCENT = "#865E4C"
LINE = "#D8D1C5"
FONT_DIR = Path("C:/Windows/Fonts")


def font(name, size):
    return ImageFont.truetype(str(FONT_DIR / name), size)


serif = font("georgia.ttf", 72)
serif_title = font("georgia.ttf", 83)
serif_brand = font("georgiab.ttf", 72)
sans = font("segoeui.ttf", 34)
sans_small = font("segoeui.ttf", 29)
sans_bold = font("segoeuib.ttf", 34)
sans_label = font("segoeuib.ttf", 27)


def spaced(draw, xy, value, fill, face, gap):
    x, y = xy
    for char in value:
        draw.text((x, y), char, font=face, fill=fill)
        x += draw.textlength(char, font=face) + gap


def wrap(draw, value, face, max_width):
    lines = []
    line = ""
    for word in value.split():
        candidate = f"{line} {word}" if line else word
        if draw.textlength(candidate, font=face) <= max_width:
            line = candidate
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def bookmark(draw, x, y, color):
    draw.line([(x, y), (x + 34, y), (x + 34, y + 49), (x + 17, y + 39), (x, y + 49), (x, y)], fill=color, width=4, joint="curve")


def share(draw, x, y, color):
    draw.line([(x + 16, y + 10), (x + 16, y + 51)], fill=color, width=4)
    draw.line([(x + 3, y + 23), (x + 16, y + 10), (x + 29, y + 23)], fill=color, width=4, joint="curve")
    draw.line([(x - 2, y + 42), (x - 2, y + 62), (x + 34, y + 62), (x + 34, y + 42)], fill=color, width=4, joint="curve")


base = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(base)

# Quiet editorial masthead.
d.text((77, 108), "merak", font=serif_brand, fill=INK)
brand_width = d.textlength("merak", font=serif_brand)
d.text((77 + brand_width - 2, 108), ".", font=serif_brand, fill=ACCENT)
label = "KAYDEDİLENLER"
label_width = sum(d.textlength(c, font=sans_label) + 2 for c in label)
spaced(d, (W - 77 - label_width, 131), label, INK, sans_label, 2)

spaced(d, (78, 520), "KISA BİR DURAK", ACCENT, sans_label, 7)

text = (
    "Sabahın ilk vapurunda herkes bir yere yetişiyordu. "
    "Yaşlı adam ise camın önüne oturmuş, kıyıdaki evleri tek tek sayıyordu. "
    "Karşı yakaya varınca inmek için acele etmedi; sanki yolculuğun bir yere varması gerekmiyordu."
)
lines = wrap(d, text, serif, W - 156)
y = 608
for line in lines:
    d.text((77, y), line, font=serif, fill=INK)
    y += 105

d.line([(77, 1630), (1003, 1630)], fill=LINE, width=2)
d.text((77, 1674), "Örnek pasaj", font=sans_bold, fill=INK)
d.text((77, 1725), "Tasarım taslağı", font=sans_small, fill=MUTED)
bookmark(d, 864, 1682, INK)
share(d, 958, 1678, INK)

base.save(OUT / "merak-pasaj-ekrani.png", optimize=True)

# Source sheet preview, using the same screen beneath a dim overlay.
sheet = base.convert("RGBA")
overlay = Image.new("RGBA", (W, H), (37, 36, 31, 83))
sheet.alpha_composite(overlay)
sd = ImageDraw.Draw(sheet)
sd.rectangle((0, 1150, W, H), fill=PAPER)
sd.line([(0, 1150), (W, 1150)], fill=LINE, width=2)
spaced(sd, (78, 1228), "KAYNAK", ACCENT, sans_label, 7)
sd.text((952, 1204), "×", font=font("segoeui.ttf", 72), fill=MUTED)
sd.text((77, 1334), "Örnek pasaj", font=serif_title, fill=INK)
note = (
    "Bu metin yalnızca tasarımı göstermek için yazıldı. "
    "Yayındaki pasajlarda kitabın ve yazarın gerçek bilgileri yer alacak."
)
ny = 1470
for line in wrap(sd, note, sans, W - 154):
    sd.text((77, ny), line, font=sans, fill=MUTED)
    ny += 58
sheet.convert("RGB").save(OUT / "merak-kaynak-karti.png", optimize=True)

print(OUT / "merak-pasaj-ekrani.png")
print(OUT / "merak-kaynak-karti.png")
