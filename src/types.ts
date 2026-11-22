export interface Passage {
  id: string;
  text: string;
  bookTitle: string;
  author: string;
  translator: string | null;
  sourceUrl: string | null;
  curated: boolean;
  contributorName: string;
  createdAt: string;
  dailyBatch?: string | null;
}

export interface PassagePage {
  items: Passage[];
  nextCursor: string | null;
}

export interface NewPassage {
  text: string;
  bookTitle: string;
  author: string;
  translator: string;
  sourceUrl: string;
  contributorName: string;
}

export type ReportReason = "copyright" | "spam" | "incorrect_source" | "other";
