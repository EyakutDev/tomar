import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const databaseUrl = process.env.TOMAR_TEST_DATABASE_URL;
const run = promisify(execFile);

test("günlük yayın eşzamanlı tekrarlarla çoğalmaz ve sayfalama sürümünü korur", { skip: !databaseUrl }, async () => {
  assert.ok(new URL(databaseUrl!).pathname.startsWith("/tomar_test_"), "Yalnızca ayrılmış test veritabanı kullanılabilir.");
  process.env.DATABASE_URL = databaseUrl;
  const { pool, initDatabase } = await import("./db.js");
  const env = { ...process.env, DATABASE_URL: databaseUrl!, HOST: "127.0.0.1", PORT: "3017" };
  const daily = fileURLToPath(new URL("./daily.js", import.meta.url));
  const day = "2026-11-22";
  const runDaily = async () => {
    const result = await run(process.execPath, [daily, day], { env });
    return JSON.parse(result.stdout.trim()) as { added: number; ids: string[]; version: string };
  };
  await initDatabase();
  const empty = await pool.query("SELECT 1 FROM passages LIMIT 1");
  assert.equal(empty.rows.length, 0, "Test veritabanı boş olmalı.");
  const curated = JSON.parse(await readFile(new URL("../content/curated-passages.json", import.meta.url), "utf8")) as {
    text: string; author: string; bookTitle: string; dailyBatch?: string;
  }[];
  for (const item of curated.filter(item => !item.dailyBatch)) {
    await pool.query("INSERT INTO passages (text, book_title, author, curated) VALUES ($1, $2, $3, true)", [item.text, item.bookTitle, item.author]);
  }
  const initial = (await pool.query("SELECT count(*)::int AS count FROM passages")).rows[0].count as number;
  const server = spawn(process.execPath, [fileURLToPath(new URL("./index.js", import.meta.url))], { env, stdio: "ignore" });
  try {
    const base = "http://127.0.0.1:3017";
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      ready = await fetch(base + "/api/health").then(response => response.ok).catch(() => false);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Test API başlatılamadı.");
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(base + path, init);
      assert.ok(response.ok, `HTTP ${response.status} for ${path}`);
      return response.json() as Promise<any>;
    };
    const legacy = await request("/api/passages");
    const results = await Promise.all([runDaily(), runDaily()]);
    assert.deepEqual(results.map(result => result.added).sort((a, b) => a - b), [0, 10]);
    assert.deepEqual(results[0].ids, results[1].ids);
    assert.equal(results[0].version, results[1].version);

    const drain = async (first: any) => {
      const items = [...first.items];
      let cursor = first.nextCursor;
      const seen = new Set<string>();
      while (cursor) {
        assert.ok(!seen.has(cursor), "Sayfalama döngüsü oluştu.");
        seen.add(cursor);
        const page = await request("/api/passages?before=" + encodeURIComponent(cursor));
        items.push(...page.items);
        cursor = page.nextCursor;
      }
      assert.equal(new Set(items.map(item => item.id)).size, items.length);
      return items as { id: string; dailyBatch: string | null }[];
    };
    assert.equal((await drain(legacy)).length, initial);
    const snapshot = await request("/api/passages");
    assert.match(snapshot.nextCursor, /^v\d+:\d+$/);
    const ordered = await drain(snapshot);
    assert.equal(ordered.length, initial + 10);
    const recent = ordered.filter(item => item.dailyBatch === day);
    assert.equal(recent.length, 10);
    assert.deepEqual(new Set(recent.map(item => item.id)), new Set(results[0].ids));
    for (let index = 1; index < ordered.length; index++) {
      assert.ok(ordered[index].dailyBatch !== day || ordered[index - 1].dailyBatch !== day);
    }
    for (const id of ["1", ...results[0].ids]) {
      assert.equal((await request("/api/passages/" + id)).id, id);
    }

    const published = await request("/api/passages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: curated[0].text, bookTitle: "Test kullanıcı gönderisi", author: "Test okuru" }),
    });
    const fresh = await drain(await request("/api/passages"));
    assert.equal(fresh.length, initial + 11);
    assert.equal(fresh[0].id, published.id);
    assert.deepEqual(await drain(snapshot), ordered);
    const retry = await runDaily();
    assert.equal(retry.added, 0);
    assert.equal((await drain(await request("/api/passages"))).length, initial + 11);
    const badCursor = await fetch(base + "/api/passages?before=v99999999999999999999:1");
    assert.equal(badCursor.status, 400);

    await pool.query("TRUNCATE daily_publications, feed_positions, feed_versions, passages RESTART IDENTITY CASCADE");
    await run(process.execPath, [fileURLToPath(new URL("./seed-curated.js", import.meta.url))], { env });
    const adopted = await runDaily();
    assert.equal(adopted.added, 0);
    assert.equal(adopted.ids.length, 10);
    assert.equal((await drain(await request("/api/passages"))).length, curated.length);

    const batch = JSON.parse(await readFile(new URL("../content/daily/2026-11-22.json", import.meta.url), "utf8")) as { text: string }[];
    await pool.query("DELETE FROM daily_publications");
    await pool.query("DELETE FROM feed_positions");
    await pool.query("DELETE FROM feed_versions");
    await pool.query("DELETE FROM passages WHERE daily_batch = $1::date AND text <> $2", [day, batch.at(-1)!.text]);
    await pool.query("UPDATE passages SET daily_batch = NULL WHERE daily_batch = $1::date", [day]);
    await assert.rejects(runDaily(), /Daha önce eklenmiş pasaj/);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM passages")).rows[0].count, initial + 1);
    assert.equal((await pool.query("SELECT 1 FROM daily_publications")).rows.length, 0);
    assert.equal((await pool.query("SELECT 1 FROM passages WHERE daily_batch = $1::date", [day])).rows.length, 0);
  } finally {
    server.kill("SIGTERM");
    await pool.end();
  }
});
