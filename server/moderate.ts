import "dotenv/config";
import { pool } from "./db.js";

const [action, id] = process.argv.slice(2);

try {
  if (action === "list") {
    const result = await pool.query<{
      report_id: string;
      passage_id: string;
      reason: string;
      details: string | null;
      created_at: Date;
      book_title: string;
    }>(
      `SELECT r.id::text AS report_id, r.passage_id::text, r.reason, r.details,
              r.created_at, p.book_title
       FROM reports r JOIN passages p ON p.id = r.passage_id
       WHERE r.resolved_at IS NULL
       ORDER BY r.created_at DESC LIMIT 30`,
    );
    console.table(result.rows.map(row => ({
      report: row.report_id,
      passage: row.passage_id,
      book: row.book_title,
      reason: row.reason,
      details: row.details ?? "",
      created: row.created_at.toISOString(),
    })));
  } else if (action === "remove" && id && /^[1-9]\d*$/.test(id)) {
    const result = await pool.query(
      "UPDATE passages SET removed_at = now() WHERE id = $1 AND removed_at IS NULL RETURNING id",
      [id],
    );
    if (!result.rows[0]) throw new Error("Yayında böyle bir pasaj bulunamadı.");
    await pool.query("UPDATE reports SET resolved_at = now() WHERE passage_id = $1 AND resolved_at IS NULL", [id]);
    console.log(`Pasaj ${id} yayından kaldırıldı.`);
  } else if (action === "resolve" && id && /^[1-9]\d*$/.test(id)) {
    const result = await pool.query(
      "UPDATE reports SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL RETURNING id",
      [id],
    );
    if (!result.rows[0]) throw new Error("Açık böyle bir bildirim bulunamadı.");
    console.log(`Bildirim ${id} kapatıldı.`);
  } else {
    console.error("Kullanım: npm run moderate -- list | remove <pasaj-id> | resolve <bildirim-id>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
