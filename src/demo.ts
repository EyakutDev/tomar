import type { NewPassage, Passage, PassagePage, ReportReason } from "./types";
import curated from "../content/curated-passages.json";

// Keep the original keys so existing demo posts and reports remain available.
const POSTS_KEY = "merak:demo:posts";
const REPORTS_KEY = "merak:demo:reports";

const examples: Passage[] = curated.map((passage, index) => ({
  id: passage.demoId,
  text: passage.text,
  bookTitle: passage.bookTitle,
  author: passage.author,
  translator: "translator" in passage && typeof passage.translator === "string" ? passage.translator : null,
  sourceUrl: passage.sourceUrl,
  curated: true,
  contributorName: "Tomar",
  createdAt: new Date(2026, 10, 9 - index).toISOString(),
  dailyBatch: "dailyBatch" in passage && typeof passage.dailyBatch === "string" ? passage.dailyBatch : null,
}));

const snapshots = new Map<string, Passage[]>();
let nextSnapshot = 0;

function userPosts(): Passage[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(POSTS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is Passage =>
      typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.text === "string") : [];
  } catch {
    return [];
  }
}

export function demoPassages(before?: string): PassagePage {
  const cursor = before?.match(/^v(\d+):(\d+)$/);
  if (before && !cursor) {
    const page = [...userPosts(), ...examples].filter(item => BigInt(item.id) < BigInt(before))
      .sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1).slice(0, 21);
    return { items: page.slice(0, 20), nextCursor: page.length > 20 ? page[19].id : null };
  }
  const version = cursor?.[1] ?? String(++nextSnapshot);
  if (!before) snapshots.set(version, [...userPosts(), ...examples]);
  const ordered = snapshots.get(version);
  if (!ordered) throw new Error("Önizleme akışını yeniden açın.");
  const start = Number(cursor?.[2] ?? 0);
  const items = ordered.slice(start, start + 20);
  return { items, nextCursor: start + items.length < ordered.length ? `v${version}:${start + items.length}` : null };
}

export function demoPassage(id: string): Passage | null {
  return [...userPosts(), ...examples].find(item => item.id === id) ?? null;
}

export function demoPublish(input: NewPassage): Passage {
  const text = input.text.trim();
  if (text.length < 80 || text.length > 1600 || !input.bookTitle.trim() || !input.author.trim()) {
    throw new Error("Pasaj 80–1600 karakter olmalı; kitap ve yazar adı gerekli.");
  }
  const sourceUrl = input.sourceUrl.trim();
  if (sourceUrl && (!/^https:\/\//i.test(sourceUrl) || sourceUrl.length > 500)) {
    throw new Error("Kaynak bağlantısı en fazla 500 karakterlik HTTPS adresi olmalı.");
  }
  const item: Passage = {
    id: String(Date.now()),
    text,
    bookTitle: input.bookTitle.trim(),
    author: input.author.trim(),
    translator: input.translator.trim() || null,
    sourceUrl: sourceUrl || null,
    curated: false,
    contributorName: input.contributorName.trim() || "Okur",
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(POSTS_KEY, JSON.stringify([item, ...userPosts()]));
  return item;
}

export function demoReport(passageId: string, reason: ReportReason, details: string): void {
  const reports = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]") as unknown[];
  reports.push({ passageId, reason, details, createdAt: new Date().toISOString() });
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}
