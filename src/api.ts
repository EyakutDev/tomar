import type { NewPassage, Passage, PassagePage, ReportReason } from "./types";
import { demoPassage, demoPassages, demoPublish, demoReport } from "./demo";

export const isDemo = import.meta.env.VITE_DEMO_MODE === "true";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Bir hata oluştu. Tekrar deneyin.");
  return payload as T;
}

export function getPassages(before?: string): Promise<PassagePage> {
  if (isDemo) return Promise.resolve(demoPassages(before));
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return request<PassagePage>(`/api/passages${query}`);
}

export function getPassage(id: string): Promise<Passage> {
  if (isDemo) {
    const item = demoPassage(id);
    return item ? Promise.resolve(item) : Promise.reject(new Error("Pasaj bulunamadı."));
  }
  return request<Passage>(`/api/passages/${encodeURIComponent(id)}`);
}

export function publishPassage(input: NewPassage): Promise<Passage> {
  if (isDemo) return Promise.resolve().then(() => demoPublish(input));
  return request<Passage>("/api/passages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function reportPassage(passageId: string, reason: ReportReason, details: string): Promise<{ ok: true }> {
  if (isDemo) return Promise.resolve().then(() => { demoReport(passageId, reason, details); return { ok: true }; });
  return request<{ ok: true }>("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passageId, reason, details }),
  });
}
