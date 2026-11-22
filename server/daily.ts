import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initDatabase, pool } from "./db.js";
import { lockFeed, saveFeed } from "./feed.js";
import { mixPassages } from "./feed-order.js";
import { validatePassage } from "./validation.js";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = process.argv[2] ?? today;

try {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error("Geçersiz günlük yayın tarihi.");
  const path = fileURLToPath(new URL(`../content/daily/${day}.json`, import.meta.url));
  const batch = JSON.parse(await readFile(path, "utf8")) as {
    text: string; author: string; bookTitle: string; translator?: string; sourceUrl: string;
  }[];
  if (!Array.isArray(batch) || batch.length !== 10) throw new Error("Günlük seçki tam 10 pasaj içermeli.");
  const inputs = batch.map(item => {
    const result = validatePassage({ ...item, contributorName: "Tomar", translator: item.translator ?? "" });
    if (!result.ok) throw new Error(result.error);
    if (!result.value.sourceUrl) throw new Error("Seçki için kaynak bağlantısı gerekli.");
    return result.value;
  });
  const contentKeys = inputs.map(item => (item.author + "\n" + item.text).normalize("NFC").replace(/\s+/g, " ").toLocaleLowerCase("tr"));
  if (new Set(contentKeys).size !== 10) throw new Error("Günlük seçkide tekrar eden pasaj var.");
  const fingerprint = createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
  await initDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockFeed(client);
    const existing = await client.query<{ fingerprint: string; ids: string[]; version: string }>(
      "SELECT fingerprint, passage_ids::text[] AS ids, feed_version::text AS version FROM daily_publications WHERE day = $1::date", [day],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].fingerprint !== fingerprint) throw new Error("Bu tarihin seçkisi daha önce farklı bir içerikle yayımlandı.");
      await client.query("COMMIT");
      console.log(JSON.stringify({ day, added: 0, ids: existing.rows[0].ids, version: existing.rows[0].version }));
    } else {
      const newest = await client.query<{ day: string }>("SELECT day::text FROM daily_publications ORDER BY day DESC LIMIT 1");
      if (newest.rows[0]?.day > day) throw new Error("Daha eski tarihli seçki güncel sıralamanın üzerine yayımlanamaz.");
      const ids: string[] = [];
      let added = 0;
      for (const item of inputs) {
        const duplicate = await client.query<{ id: string; day: string | null; removed: boolean }>(
          `SELECT id::text, daily_batch::text AS day, removed_at IS NOT NULL AS removed FROM passages WHERE
           lower(regexp_replace(text, '\\s+', ' ', 'g')) = lower(regexp_replace($1::text, '\\s+', ' ', 'g'))
           AND lower(author) = lower($2::text) LIMIT 1`, [item.text, item.author],
        );
        if (duplicate.rows[0]) {
          if (duplicate.rows[0].day !== day || duplicate.rows[0].removed) throw new Error(`Daha önce eklenmiş pasaj: ${item.bookTitle}`);
          ids.push(duplicate.rows[0].id);
          continue;
        }
        const result = await client.query<{ id: string }>(
          `INSERT INTO passages (text, book_title, author, translator, source_url, contributor_name, curated, daily_batch)
           VALUES ($1, $2, $3, $4, $5, 'Tomar', true, $6::date) RETURNING id::text`,
          [item.text, item.bookTitle, item.author, item.translator || null, item.sourceUrl, day],
        );
        ids.push(result.rows[0].id);
        added++;
      }
      const passages = await client.query<{ id: string; dailyBatch: string | null }>(
        'SELECT id::text, daily_batch::text AS "dailyBatch" FROM passages WHERE removed_at IS NULL ORDER BY id',
      );
      const dailyIds = passages.rows.filter(item => item.dailyBatch === day).map(item => item.id);
      if (new Set(ids).size !== 10 || dailyIds.length !== 10 || dailyIds.some(id => !ids.includes(id))) {
        throw new Error("Günlük yayın tam 10 benzersiz pasaj içermeli.");
      }
      const order = mixPassages(passages.rows).map(item => item.id);
      const version = await saveFeed(client, order);
      await client.query(
        "INSERT INTO daily_publications (day, fingerprint, passage_ids, feed_version) VALUES ($1::date, $2, $3::bigint[], $4::bigint)",
        [day, fingerprint, ids, version],
      );
      await client.query("COMMIT");
      console.log(JSON.stringify({ day, added, ids, version }));
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
