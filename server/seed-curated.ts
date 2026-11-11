import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { initDatabase, pool } from "./db.js";

interface CuratedPassage {
  text: string;
  bookTitle: string;
  author: string;
  translator?: string;
  sourceUrl: string;
}

const contentPath = fileURLToPath(new URL("../content/curated-passages.json", import.meta.url));
const passages = JSON.parse(await readFile(contentPath, "utf8")) as CuratedPassage[];

try {
  await initDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let added = 0;
    // Akış en yeni kaydı önce gösteriyor; dosyadaki ilk seçki üste gelsin.
    for (const passage of [...passages].reverse()) {
      if (passage.text.length < 80 || passage.text.length > 1600 || !/^https:\/\//.test(passage.sourceUrl)) {
        throw new Error(`Geçersiz seçki: ${passage.bookTitle}`);
      }
      const result = await client.query(
        `INSERT INTO passages (text, book_title, author, translator, source_url, contributor_name, curated)
         SELECT $1::text, $2::varchar, $3::varchar, $4::varchar, $5::text, 'Tomar', true
         WHERE NOT EXISTS (SELECT 1 FROM passages WHERE text = $1::text AND author = $3::varchar)
         RETURNING id`,
        [passage.text, passage.bookTitle, passage.author, passage.translator ?? null, passage.sourceUrl],
      );
      added += result.rowCount ?? 0;
      await client.query(
        `UPDATE passages SET translator = $3::varchar, source_url = $4::text, curated = true
         WHERE text = $1::text AND author = $2::varchar AND removed_at IS NULL`,
        [passage.text, passage.author, passage.translator ?? null, passage.sourceUrl],
      );
    }
    const removed = await client.query(
      `UPDATE passages SET removed_at = now()
       WHERE removed_at IS NULL AND book_title = 'Merak için yazılmış örnek metin'
         AND author = 'Merak ekibi'`,
    );
    await client.query("COMMIT");
    console.log(`${added} gerçek kitap pasajı eklendi; ${removed.rowCount ?? 0} eski örnek kaldırıldı.`);
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
