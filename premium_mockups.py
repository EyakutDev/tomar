from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "design"
OUT.mkdir(exist_ok=True)
FONTS = Path("C:/Windows/Fonts")
W, H = 1080, 1920

PASSAGE = (
    "Sabahın ilk vapurunda herkes bir yere yetişiyordu. "
    "Yaşlı adam camın önüne oturmuş, kıyıdaki evleri tek tek sayıyordu. "
    "Karşı yakaya varınca yerinden kalkmadı. Yolculuk bitmişti; onun acelesi yoktu."
)


def f(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def tracking(draw, text, x, y, face, fill, spacing=4):
    for ch in text:
        draw.text((x, y), ch, font=face, fill=fill)
        x += draw.textlength(ch, font=face) + spacing
    return x


def lines(draw, text, face, width):
    result, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}" if line else word
        if draw.textlength(candidate, font=face) <= width:
            line = candidate
        else:
            result.append(line)
            line = word
    if line:
        result.append(line)
    return result


def paragraph(draw, text, x, y, width, face, fill, leading):
    for line in lines(draw, text, face, width):
        draw.text((x, y), line, font=face, fill=fill)
        y += leading
    return y


def icons(draw, y, color, with_labels=False):
    x = 790 if with_labels else 858
    draw.line([(x, y), (x+36, y), (x+36, y+52), (x+18, y+41), (x, y+52), (x, y)], fill=color, width=3, joint="curve")
    if with_labels:
        draw.text((x-9, y+71), "KAYDET", font=f("segoeui.ttf", 21), fill=color)
    x = 950
    draw.line([(x+18, y+5), (x+18, y+52)], fill=color, width=3)
    draw.line([(x+4, y+20), (x+18, y+5), (x+32, y+20)], fill=color, width=3, joint="curve")
    draw.line([(x-2, y+44), (x-2, y+66), (x+38, y+66), (x+38, y+44)], fill=color, width=3, joint="curve")
    if with_labels:
        draw.text((x-12, y+71), "PAYLAŞ", font=f("segoeui.ttf", 21), fill=color)


def quiet_texture(image, strength=0.018):
    noise = Image.effect_noise((W, H), 28).convert("RGB")
    return Image.blend(image, noise, strength)


# 1: warm editorial / restrained book design.
paper, ink, bronze, soft = "#F1EEE6", "#24231F", "#866D56", "#746F66"
editorial = quiet_texture(Image.new("RGB", (W, H), paper), .012)
d = ImageDraw.Draw(editorial)
d.line([(76, 99), (1004, 99)], fill=bronze, width=2)
d.text((76, 139), "merak", font=f("BASKVILL.TTF", 82), fill=ink)
d.text((267, 139), ".", font=f("BASKVILL.TTF", 82), fill=bronze)
tracking(d, "KAYDEDİLENLER", 748, 165, f("segoeui.ttf", 25), ink, 3)
d.line([(77, 514), (77, 1185)], fill=bronze, width=3)
tracking(d, "BİR PASAJ", 118, 500, f("segoeuib.ttf", 26), bronze, 7)
paragraph(d, PASSAGE, 118, 598, 850, f("cambria.ttc", 63), ink, 92)
d.line([(77, 1587), (1004, 1587)], fill="#C9C1B4", width=2)
tracking(d, "KAYNAK", 77, 1638, f("segoeuib.ttf", 24), bronze, 6)
d.text((77, 1694), "Örnek pasaj", font=f("BASKVILL.TTF", 50), fill=ink)
d.text((77, 1762), "Tasarım taslağı", font=f("segoeui.ttf", 28), fill=soft)
icons(d, 1698, ink, False)
editorial.save(OUT / "premium-01-editorial.png", optimize=True)


# 2: deep ink / collected edition.
night, ivory, gold, dim = "#172329", "#F4EEE3", "#BBA17C", "#A7AFAD"
nocturne = quiet_texture(Image.new("RGB", (W, H), night), .009)
d = ImageDraw.Draw(nocturne)
tracking(d, "MERAK", 77, 120, f("segoeuil.ttf", 45), ivory, 12)
d.ellipse((408, 153, 418, 163), fill=gold)
tracking(d, "KAYDEDİLENLER", 748, 130, f("segoeui.ttf", 24), ivory, 3)
d.line([(77, 235), (1003, 235)], fill="#617175", width=2)
tracking(d, "OKUMA SEÇKİSİ", 78, 498, f("segoeui.ttf", 25), gold, 7)
d.text((72, 543), "“", font=f("BASKVILL.TTF", 158), fill=gold)
paragraph(d, PASSAGE, 77, 700, 925, f("georgia.ttf", 68), ivory, 101)
d.line([(77, 1585), (1003, 1585)], fill="#617175", width=2)
d.text((77, 1642), "Örnek pasaj", font=f("georgia.ttf", 51), fill=ivory)
tracking(d, "TASARIM TASLAĞI", 79, 1731, f("segoeui.ttf", 24), dim, 4)
icons(d, 1661, ivory, False)
nocturne.save(OUT / "premium-02-nocturne.png", optimize=True)


# 3: contemporary gallery / asymmetric typographic treatment.
sage, charcoal, olive, muted = "#E8EAE1", "#202720", "#63715B", "#6B7468"
gallery = quiet_texture(Image.new("RGB", (W, H), sage), .008)
d = ImageDraw.Draw(gallery)
d.rectangle((0, 0, W, 41), fill=olive)
tracking(d, "MERAK", 74, 114, f("segoeuib.ttf", 48), charcoal, 8)
tracking(d, "KAYDEDİLENLER", 747, 136, f("segoeui.ttf", 24), charcoal, 3)
d.line([(77, 276), (1003, 276)], fill=olive, width=2)
tracking(d, "KISA BİR DURAK", 77, 463, f("segoeuib.ttf", 25), olive, 7)
d.text((74, 570), "Sabahın ilk vapurunda", font=f("georgia.ttf", 82), fill=charcoal)
d.text((74, 690), "herkes bir yere", font=f("georgia.ttf", 82), fill=charcoal)
d.text((74, 810), "yetişiyordu.", font=f("georgia.ttf", 82), fill=charcoal)
d.line([(77, 1005), (325, 1005)], fill=olive, width=3)
remainder = (
    "Yaşlı adam camın önüne oturmuş, kıyıdaki evleri tek tek sayıyordu. "
    "Karşı yakaya varınca yerinden kalkmadı. Yolculuk bitmişti; onun acelesi yoktu."
)
paragraph(d, remainder, 77, 1065, 915, f("cambria.ttc", 57), charcoal, 84)
d.line([(77, 1588), (1003, 1588)], fill="#B9C0B4", width=2)
d.text((77, 1651), "Örnek pasaj", font=f("BASKVILL.TTF", 49), fill=charcoal)
tracking(d, "TASARIM TASLAĞI", 78, 1739, f("segoeui.ttf", 23), muted, 4)
icons(d, 1662, charcoal, False)
gallery.save(OUT / "premium-03-gallery.png", optimize=True)


def rounded_page(image, surround, destination):
    margin = 60
    radius = 76
    board = Image.new("RGB", (W + margin * 2, H + margin * 2), surround)
    shadow = Image.new("L", board.size, 0)
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((margin, margin + 18, margin + W, margin + 18 + H), radius=radius, fill=75)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    darkening = Image.new("RGB", board.size, "#151615")
    board.paste(darkening, (0, 0), shadow)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, W - 1, H - 1), radius=radius, fill=255)
    board.paste(image, (margin, margin), mask)
    board.save(OUT / destination, optimize=True)


rounded_page(editorial, "#D8D1C4", "premium-01-editorial-rounded.png")
rounded_page(nocturne, "#0D1519", "premium-02-nocturne-rounded.png")
rounded_page(gallery, "#C5CBBF", "premium-03-gallery-rounded.png")



# Community contribution: the reader can enter a passage without crowding the feed.
community = quiet_texture(Image.new("RGB", (W, H), paper), .012)
d = ImageDraw.Draw(community)
d.line([(76, 99), (1004, 99)], fill=bronze, width=2)
d.text((76, 139), "merak", font=f("BASKVILL.TTF", 82), fill=ink)
d.text((267, 139), ".", font=f("BASKVILL.TTF", 82), fill=bronze)
d.text((783, 154), "+", font=f("segoeuil.ttf", 45), fill=bronze)
tracking(d, "EKLE", 826, 169, f("segoeui.ttf", 25), ink, 4)
d.line([(976, 151), (1002, 151), (1002, 194), (989, 185), (976, 194), (976, 151)], fill=ink, width=3)
d.line([(77, 514), (77, 1185)], fill=bronze, width=3)
tracking(d, "TOPLULUKTAN", 118, 500, f("segoeuib.ttf", 26), bronze, 6)
paragraph(d, PASSAGE, 118, 598, 850, f("cambria.ttc", 63), ink, 92)
d.line([(77, 1587), (1004, 1587)], fill="#C9C1B4", width=2)
tracking(d, "KAYNAK", 77, 1630, f("segoeuib.ttf", 23), bronze, 6)
d.text((77, 1683), "Örnek pasaj", font=f("BASKVILL.TTF", 48), fill=ink)
d.text((77, 1752), "Tasarım taslağı · Deniz'in seçkisi", font=f("segoeui.ttf", 26), fill=soft)
icons(d, 1698, ink, False)
rounded_page(community, "#D8D1C4", "community-feed-rounded.png")

submit = quiet_texture(Image.new("RGB", (W, H), paper), .012)
d = ImageDraw.Draw(submit)
d.line([(76, 99), (1004, 99)], fill=bronze, width=2)
d.text((76, 139), "merak", font=f("BASKVILL.TTF", 82), fill=ink)
d.text((267, 139), ".", font=f("BASKVILL.TTF", 82), fill=bronze)
tracking(d, "KAPAT", 869, 167, f("segoeui.ttf", 25), ink, 3)
tracking(d, "SENİN SEÇKİN", 77, 332, f("segoeuib.ttf", 25), bronze, 7)
d.text((77, 401), "Bir pasaj paylaş.", font=f("cambria.ttc", 81), fill=ink)
d.text((77, 523), "Okurken durup yeniden baktığın bölümü ekle.", font=f("segoeui.ttf", 31), fill=soft)
tracking(d, "PASAJ", 77, 678, f("segoeuib.ttf", 24), bronze, 6)
d.rounded_rectangle((77, 738, 1003, 1088), radius=25, outline="#BDB4A6", width=2)
paragraph(d, "Pasaj metnini buraya yaz...", 111, 786, 850, f("cambria.ttc", 48), "#918A7E", 72)
tracking(d, "KİTAP ADI", 77, 1148, f("segoeuib.ttf", 24), bronze, 6)
d.text((77, 1206), "Kitabın adı", font=f("cambria.ttc", 43), fill="#918A7E")
d.line([(77, 1283), (1003, 1283)], fill="#BDB4A6", width=2)
tracking(d, "YAZAR / ÇEVİRMEN", 77, 1344, f("segoeuib.ttf", 24), bronze, 6)
d.text((77, 1402), "Yazar ve varsa çevirmen", font=f("cambria.ttc", 43), fill="#918A7E")
d.line([(77, 1479), (1003, 1479)], fill="#BDB4A6", width=2)
d.rounded_rectangle((77, 1577, 1003, 1695), radius=27, fill=ink)
button_text = "PASAJI YAYINLA"
button_face = f("segoeuib.ttf", 29)
button_w = d.textlength(button_text, font=button_face)
d.text(((W - button_w) / 2, 1615), button_text, font=button_face, fill=paper)
d.text((77, 1755), "Paylaşımın akışta hemen görünür.", font=f("segoeui.ttf", 27), fill=soft)
rounded_page(submit, "#D8D1C4", "community-submit-rounded.png")

print("Created premium concepts and community screens in", OUT)
