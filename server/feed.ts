import type { PoolClient } from "pg";

export async function lockFeed(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('tomar-feed'))");
}

export async function orderedIds(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    `SELECT p.id::text FROM passages p
     LEFT JOIN feed_positions f ON f.passage_id = p.id
       AND f.version_id = (SELECT max(id) FROM feed_versions)
     WHERE p.removed_at IS NULL
     ORDER BY f.position ASC NULLS FIRST, p.id DESC`,
  );
  return result.rows.map(row => row.id);
}

export async function saveFeed(client: PoolClient, ids: string[]): Promise<string> {
  const result = await client.query<{ id: string }>("INSERT INTO feed_versions DEFAULT VALUES RETURNING id::text");
  const version = result.rows[0].id;
  await client.query(
    `INSERT INTO feed_positions (version_id, passage_id, position)
     SELECT $1::bigint, passage_id, position FROM unnest($2::bigint[]) WITH ORDINALITY AS entries(passage_id, position)`,
    [version, ids],
  );
  return version;
}
