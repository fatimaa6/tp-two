import pg from "pg";
import { DateTime } from "luxon";
import type { AppConfig } from "../../src/server/config";
import { migrate } from "../../src/server/db/migrate";
import { seed } from "../../src/server/db/seed";
import type { Deps } from "../../src/server/deps";
import { MemoryMailer } from "../../src/server/email/mailer";
import { handle } from "../../src/server/http/router";
import { hashPassword } from "../../src/server/security";

export const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/salon_test";
export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "mot-de-passe-de-test-solide";
export const BASE = "http://localhost:8888";
export const paris = (iso: string) => DateTime.fromISO(iso, { zone: "Europe/Paris" }).toJSDate();

export interface TestEnv {
  deps: Deps;
  mailer: MemoryMailer;
  clock: { now: Date };
  call: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  close: () => Promise<void>;
}

/** Base PostgreSQL réelle, schéma recréé, catalogue fictif chargé. */
export async function setupEnv(): Promise<TestEnv> {
  const pool = new pg.Pool({ connectionString: TEST_DB, max: 8 });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(pool);
  await seed(pool);
  const mailer = new MemoryMailer();
  const clock = { now: paris("2026-11-30T08:00") };
  const config: AppConfig = {
    env: "test",
    databaseUrl: TEST_DB,
    appBaseUrl: BASE,
    adminEmail: ADMIN_EMAIL,
    adminPasswordHash: await hashPassword(ADMIN_PASSWORD),
    mailMode: "log",
    smtp: { host: "", port: 0, user: "", pass: "" },
    mailFrom: "Studio Sillage <test@example.com>",
    salonInbox: "salon@example.com",
  };
  const deps: Deps = { pool, mailer, config, now: () => clock.now };
  const call: TestEnv["call"] = (method, path, body, headers = {}) =>
    handle(
      new Request(`${BASE}/api${path}`, {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
      deps,
    );
  return { deps, mailer, clock, call, close: () => pool.end() };
}
