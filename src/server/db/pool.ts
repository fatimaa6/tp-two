import pg from "pg";

let pool: pg.Pool | undefined;

/** Pool partagé entre invocations d'une même instance de fonction. Petit pool : Neon gratuit + serverless. */
export function getPool(databaseUrl: string): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 3, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

export async function withTransaction<T>(p: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
