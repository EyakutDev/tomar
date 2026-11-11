import type { Passage } from "./types";

export interface ShareCard {
  blob: Blob;
  shortened: boolean;
}

function roundPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function shorten(text: string): { text: string; shortened: boolean } {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= 620) return { text: clean, shortened: false };
  const candidate = clean.slice(0, 620);
  const lastSentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("! "), candidate.lastIndexOf("? "));
  const end = lastSentence >= 410 ? lastSentence + 1 : candidate.lastIndexOf(" ");
  return { text: `${candidate.slice(0, end).trim()}…`, shortened: true };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function fitLine(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

export async function createShareCard(passage: Passage, theme: "light" | "dark"): Promise<ShareCard> {
  await document.fonts.load('400 58px "Source Serif 4 Variable"', `${passage.text} ${passage.bookTitle}`).catch(() => []);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Görsel oluşturulamadı.");

  const dark = theme === "dark";
  const surround = dark ? "#131b17" : "#e4e7e1";
  const paper = dark ? "#222b26" : "#fbfaf7";
  const ink = dark ? "#f0f0e9" : "#252b27";
  const muted = dark ? "#adb8ad" : "#6d746e";
  const rule = dark ? "#46534a" : "#d8ddd6";

  ctx.fillStyle = surround;
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = paper;
  roundPanel(ctx, 48, 48, 984, 1824, 62);

  ctx.fillStyle = ink;
  ctx.font = "68px Georgia, serif";
  ctx.fillText("tomar", 128, 185);
  ctx.strokeStyle = rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 245);
  ctx.lineTo(952, 245);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = "28px Arial, sans-serif";
  ctx.fillText(passage.curated ? "TOMAR SEÇKİSİ" : "BİR OKURUN SEÇKİSİ", 128, 350);

  const excerpt = shorten(passage.text);
  let lines: string[] = [];
  let fontSize = excerpt.text.length < 170 ? 72 : 58;
  for (; fontSize >= 40; fontSize -= 2) {
    ctx.font = `${fontSize}px "Source Serif 4 Variable", Georgia, serif`;
    lines = wrap(ctx, excerpt.text, 824);
    if (lines.length * fontSize * 1.44 <= 1040) break;
  }
  ctx.fillStyle = ink;
  ctx.font = `${fontSize}px "Source Serif 4 Variable", Georgia, serif`;
  const lineHeight = fontSize * 1.44;
  const readingTop = 390;
  const readingHeight = 1080;
  let baseline = readingTop + Math.max(0, (readingHeight - lines.length * lineHeight) / 2) + fontSize;
  for (const line of lines) {
    ctx.fillText(line, 128, baseline);
    baseline += lineHeight;
  }

  if (excerpt.shortened) {
    ctx.fillStyle = muted;
    ctx.font = "27px Arial, sans-serif";
    ctx.fillText("Pasajın devamı Tomar’da", 128, 1530);
  }

  ctx.strokeStyle = rule;
  ctx.beginPath();
  ctx.moveTo(128, 1588);
  ctx.lineTo(952, 1588);
  ctx.stroke();
  ctx.fillStyle = muted;
  ctx.font = "26px Arial, sans-serif";
  ctx.fillText("KAYNAK", 128, 1652);
  ctx.fillStyle = ink;
  ctx.font = '42px "Source Serif 4 Variable", Georgia, serif';
  ctx.fillText(fitLine(ctx, passage.bookTitle, 824), 128, 1722);
  ctx.fillStyle = muted;
  ctx.font = "29px Arial, sans-serif";
  const credit = passage.translator ? `${passage.author} · Çeviri: ${passage.translator}` : passage.author;
  ctx.fillText(fitLine(ctx, credit, 824), 128, 1774);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("Görsel oluşturulamadı.")), "image/png");
  });
  return { blob, shortened: excerpt.shortened };
}
