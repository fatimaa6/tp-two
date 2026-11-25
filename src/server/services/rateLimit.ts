import type pg from "pg";
import { HttpError } from "../http/http";

/** Limitation par fenêtre glissante, stockée en base (pas d'état en mémoire en serverless). */
export async function countRecent(pool: pg.Pool, key: string, windowMin: number, now: Date): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM rate_limit_events WHERE key=$1 AND created_at > $2",
    [key, new Date(now.getTime() - windowMin * 60_000)],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function record(pool: pg.Pool, key: string, now: Date): Promise<void> {
  await pool.query("INSERT INTO rate_limit_events (key, created_at) VALUES ($1,$2)", [key, now]);
}

export async function enforce(
  pool: pg.Pool,
  key: string,
  max: number,
  windowMin: number,
  now: Date,
): Promise<void> {
  if ((await countRecent(pool, key, windowMin, now)) >= max) {
    throw new HttpError(429, "rate_limited", "Trop de tentatives. Réessayez plus tard.");
  }
  await record(pool, key, now);
}
