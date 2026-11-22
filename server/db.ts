import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool, type QueryResultRow } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL tanımlı değil. .env.example dosyasını temel alarak .env oluşturun.");
}

export const pool = new Pool({ connectionString: databaseUrl });

export async function initDatabase(): Promise<void> {
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
}

export interface PassageRow extends QueryResultRow {
  id: string;
  text: string;
  book_title: string;
  author: string;
  translator: string | null;
  source_url: string | null;
  curated: boolean;
  contributor_name: string;
  created_at: Date;
  daily_batch: string | null;
}

export function publicPassage(row: PassageRow) {
  return {
    id: row.id,
    text: row.text,
    bookTitle: row.book_title,
    author: row.author,
    translator: row.curated && row.translator === "Merak" ? "Tomar" : row.translator,
    sourceUrl: row.source_url,
    curated: row.curated,
    contributorName: row.curated && row.contributor_name === "Merak" ? "Tomar" : row.contributor_name,
    createdAt: row.created_at.toISOString(),
    dailyBatch: row.daily_batch ?? null,
  };
}
