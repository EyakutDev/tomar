import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { initDatabase, pool, publicPassage, type PassageRow } from "./db.js";
import { validatePassage, validateReport } from "./validation.js";

const app = Fastify({
  logger: true,
  bodyLimit: 12_000,
  trustProxy: process.env.TRUST_PROXY === "true",
});
await app.register(rateLimit, { global: false });
app.addHook("onClose", async () => pool.end());

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/passages", async (request, reply) => {
  const query = request.query as { before?: string; limit?: string };
  if (query.before && !/^[1-9]\d*$/.test(query.before)) {
    return reply.code(400).send({ error: "Geçersiz sayfa konumu." });
  }
  const requestedLimit = Number(query.limit ?? 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 30) : 20;
  const result = await pool.query<PassageRow>(
    `SELECT id::text, text, book_title, author, translator, source_url, curated, contributor_name, created_at
     FROM passages
     WHERE removed_at IS NULL AND ($1::bigint IS NULL OR id < $1::bigint)
     ORDER BY passages.id DESC LIMIT $2`,
    [query.before ?? null, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const rows = result.rows.slice(0, limit);
  return {
    items: rows.map(publicPassage),
    nextCursor: hasMore ? rows.at(-1)?.id ?? null : null,
  };
});

app.get<{ Params: { id: string } }>("/api/passages/:id", async (request, reply) => {
  if (!/^[1-9]\d*$/.test(request.params.id)) {
    return reply.code(400).send({ error: "Geçersiz pasaj." });
  }
  const result = await pool.query<PassageRow>(
    `SELECT id::text, text, book_title, author, translator, source_url, curated, contributor_name, created_at
     FROM passages WHERE id = $1 AND removed_at IS NULL`,
    [request.params.id],
  );
  if (!result.rows[0]) return reply.code(404).send({ error: "Pasaj bulunamadı." });
  return publicPassage(result.rows[0]);
});

app.post("/api/passages", {
  config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
}, async (request, reply) => {
  const input = validatePassage(request.body);
  if (!input.ok) return reply.code(400).send({ error: input.error });
  const { text, bookTitle, author, translator, sourceUrl, contributorName } = input.value;
  const result = await pool.query<PassageRow>(
    `INSERT INTO passages (text, book_title, author, translator, source_url, contributor_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id::text, text, book_title, author, translator, source_url, curated, contributor_name, created_at`,
    [text, bookTitle, author, translator, sourceUrl, contributorName],
  );
  return reply.code(201).send(publicPassage(result.rows[0]));
});

app.post("/api/reports", {
  config: { rateLimit: { max: 8, timeWindow: "1 hour" } },
}, async (request, reply) => {
  const input = validateReport(request.body);
  if (!input.ok) return reply.code(400).send({ error: input.error });
  const { passageId, reason, details } = input.value;
  const result = await pool.query(
    `INSERT INTO reports (passage_id, reason, details)
     SELECT id, $2, $3 FROM passages WHERE id = $1 AND removed_at IS NULL
     RETURNING id`,
    [passageId, reason, details],
  );
  if (!result.rows[0]) return reply.code(404).send({ error: "Pasaj bulunamadı." });
  return reply.code(201).send({ ok: true });
});

const distPath = fileURLToPath(new URL("../dist/", import.meta.url));
if (existsSync(fileURLToPath(new URL("../dist/index.html", import.meta.url)))) {
  await app.register(fastifyStatic, { root: distPath, prefix: "/" });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "Bulunamadı." });
    return reply.sendFile("index.html");
  });
}

try {
  await initDatabase();
  await app.listen({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3001),
  });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
