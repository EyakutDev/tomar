type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface PassageInput {
  text: string;
  bookTitle: string;
  author: string;
  translator: string | null;
  sourceUrl: string | null;
  contributorName: string;
}

const clean = (value: unknown): string | null =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : null;

const cleanPassage = (value: unknown): string | null =>
  typeof value === "string"
    ? value.trim().replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : null;

export function validatePassage(body: unknown): ValidationResult<PassageInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Geçerli bir pasaj gönderin." };
  }

  const input = body as Record<string, unknown>;
  const text = cleanPassage(input.text);
  const bookTitle = clean(input.bookTitle);
  const author = clean(input.author);
  const translator = clean(input.translator);
  const sourceUrl = clean(input.sourceUrl);
  const contributorName = clean(input.contributorName) || "Okur";

  if (!text || text.length < 80 || text.length > 1600) {
    return { ok: false, error: "Pasaj 80–1600 karakter arasında olmalı." };
  }
  if (!bookTitle || bookTitle.length > 160) {
    return { ok: false, error: "Kitap adı gerekli ve en fazla 160 karakter olabilir." };
  }
  if (!author || author.length > 120) {
    return { ok: false, error: "Yazar adı gerekli ve en fazla 120 karakter olabilir." };
  }
  if (translator && translator.length > 120) {
    return { ok: false, error: "Çevirmen adı en fazla 120 karakter olabilir." };
  }
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password || sourceUrl.length > 500) {
        return { ok: false, error: "Kaynak bağlantısı en fazla 500 karakterlik HTTPS adresi olmalı." };
      }
    } catch {
      return { ok: false, error: "Geçerli bir kaynak bağlantısı girin." };
    }
  }
  if (contributorName.length > 60) {
    return { ok: false, error: "Paylaşan adı en fazla 60 karakter olabilir." };
  }

  return { ok: true, value: { text, bookTitle, author, translator, sourceUrl, contributorName } };
}

export type ReportReason = "copyright" | "spam" | "incorrect_source" | "other";
export interface ReportInput {
  passageId: string;
  reason: ReportReason;
  details: string | null;
}

export function validateReport(body: unknown): ValidationResult<ReportInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Geçerli bir bildirim gönderin." };
  }
  const input = body as Record<string, unknown>;
  const passageId = clean(input.passageId);
  const reason = clean(input.reason);
  const details = clean(input.details);

  if (!passageId || !/^[1-9]\d*$/.test(passageId)) {
    return { ok: false, error: "Geçerli bir pasaj seçin." };
  }
  if (!reason || !["copyright", "spam", "incorrect_source", "other"].includes(reason)) {
    return { ok: false, error: "Bildirim nedeni seçin." };
  }
  if (details && details.length > 500) {
    return { ok: false, error: "Açıklama en fazla 500 karakter olabilir." };
  }
  return { ok: true, value: { passageId, reason: reason as ReportReason, details } };
}
