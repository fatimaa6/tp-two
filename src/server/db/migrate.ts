import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type pg from "pg";

/** Applique, dans l'ordre, les fichiers SQL de db/migrations non encore appliqués. */
export async function migrate(pool: pg.Pool, dir = path.resolve("db/migrations")): Promise<string[]> {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set(
    (await pool.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Échec de la migration ${file} : ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }
  return applied;
}
