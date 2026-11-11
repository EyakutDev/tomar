from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "design"
OUT.mkdir(exist_ok=True)
W, H = 1080, 1920
FONT_DIR = Path("C:/Windows/Fonts")


def font(filename, size):
    return ImageFont.truetype(str(FONT_DIR / filename), size)


def wrapped(draw, text, face, max_width):
    lines, current = [], ""
    for word in text.split():
        candidate = f"{current} {word}" if current else word
        if draw.textlength(candidate, font=face) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def bookmark(draw, x, y, color, width=3):
    draw.line([(x, y), (x + 34, y), (x + 34, y + 49), (x + 17, y + 39), (x, y + 49), (x, y)], fill=color, width=width, joint="curve")


def share(draw, x, y, color, width=3):
    draw.line([(x + 17, y + 5), (x + 17, y + 52)], fill=color, width=width)
    draw.line([(x + 3, y + 20), (x + 17, y + 5), (x + 31, y + 20)], fill=color, width=width, joint="curve")
    draw.line([(x - 2, y + 43), (x - 2, y + 64), (x + 36, y + 64), (x + 36, y + 43)], fill=color, width=width, joint="curve")


def framed(screen, surround, name):
    margin, radius = 58, 64
    canvas = Image.new("RGB", (W + margin * 2, H + margin * 2), surround)
    shadow = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(shadow).rounded_rectangle((margin, margin + 16, margin + W, margin + H + 16), radius, fill=75)
    shadow = shadow.filter(ImageFilter.GaussianBlur(27))
    canvas.paste(Image.new("RGB", canvas.size, "#1F201E"), (0, 0), shadow)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), radius, fill=255)
    canvas.paste(screen, (margin, margin), mask)
    canvas.save(OUT / name, optimize=True)


passage = (
    "Sabahın ilk vapurunda herkes bir yere yetişiyordu. "
    "Yaşlı adam camın önüne oturmuş, kıyıdaki evleri tek tek sayıyordu. "
    "Karşı yakaya varınca herkes kapıya yöneldi. O, denizin üstünde biraz daha "
    "kalmak ister gibi yerinden kalkmadı. Biletini cebine koyup boşalan "
    "koltuklara baktı. Vapur yeniden hareket ettiğinde gülümsedi."
)


def make_feed(dark=False):
    paper = "#222725" if dark else "#F7F6F2"
    ink = "#ECECE5" if dark else "#272A27"
    muted = "#B0B7B0" if dark else "#696D68"
    rule = "#626C66" if dark else "#D2D5CF"
    accent = "#B7B1A3" if dark else "#6C746B"
    screen = Image.new("RGB", (W, H), paper)
    d = ImageDraw.Draw(screen)

    d.text((78, 125), "merak", font=font("corbel.ttf", 70), fill=ink)
    d.text((772, 152), "+", font=font("corbel.ttf", 39), fill=accent)
    d.text((814, 155), "Pasaj ekle", font=font("corbel.ttf", 30), fill=ink)
    bookmark(d, 973, 153, ink)
    d.line([(78, 270), (1002, 270)], fill=rule, width=2)

    d.text((78, 480), "Deniz'in seçkisi", font=font("corbel.ttf", 31), fill=muted)
    body = font("SitkaVF.ttf", 60)
    y = 556
    for line in wrapped(d, passage, body, 920):
        d.text((78, y), line, font=body, fill=ink)
        y += 86

    d.line([(78, 1578), (1002, 1578)], fill=rule, width=2)
    d.text((78, 1634), "Örnek kitap", font=font("corbel.ttf", 39), fill=ink)
    d.text((78, 1693), "Örnek yazar", font=font("corbel.ttf", 29), fill=muted)
    bookmark(d, 863, 1656, ink)
    share(d, 956, 1651, ink)
    framed(screen, "#171B19" if dark else "#DADBD4", "natural-feed-dark.png" if dark else "natural-feed-light.png")


def make_submit():
    paper, ink, muted, rule = "#F7F6F2", "#272A27", "#696D68", "#D2D5CF"
    screen = Image.new("RGB", (W, H), paper)
    d = ImageDraw.Draw(screen)
    d.text((78, 125), "merak", font=font("corbel.ttf", 70), fill=ink)
    d.text((912, 151), "Kapat", font=font("corbel.ttf", 30), fill=ink)
    d.line([(78, 270), (1002, 270)], fill=rule, width=2)

    d.text((78, 376), "Bir pasaj paylaş", font=font("SitkaVF.ttf", 71), fill=ink)
    d.text((78, 489), "Okurken dönüp yeniden baktığın bir bölümü ekle.", font=font("corbel.ttf", 31), fill=muted)

    d.text((78, 661), "Pasaj", font=font("corbel.ttf", 32), fill=ink)
    d.rounded_rectangle((78, 723, 1002, 1063), radius=19, outline=rule, width=2)
    d.text((112, 766), "Metni buraya yaz...", font=font("SitkaVF.ttf", 48), fill="#999D96")

    d.text((78, 1121), "Kitap adı", font=font("corbel.ttf", 32), fill=ink)
    d.line([(78, 1237), (1002, 1237)], fill=rule, width=2)
    d.text((78, 1295), "Yazar", font=font("corbel.ttf", 32), fill=ink)
    d.line([(78, 1411), (1002, 1411)], fill=rule, width=2)
    d.text((78, 1469), "Çevirmen", font=font("corbel.ttf", 32), fill=ink)
    d.text((213, 1475), "varsa", font=font("corbel.ttf", 27), fill=muted)
    d.line([(78, 1585), (1002, 1585)], fill=rule, width=2)

    d.rounded_rectangle((78, 1660, 1002, 1769), radius=23, fill=ink)
    label = "Pasajı yayınla"
    face = font("corbel.ttf", 37)
    d.text(((W - d.textlength(label, font=face)) / 2, 1687), label, font=face, fill=paper)
    d.text((78, 1814), "Paylaşımın akışta hemen görünür.", font=font("corbel.ttf", 28), fill=muted)
    framed(screen, "#DADBD4", "natural-submit.png")


make_feed(False)
make_feed(True)
make_submit()
print("Created natural typography mockups in", OUT)
