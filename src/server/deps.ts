import type pg from "pg";
import type { AppConfig } from "./config";
import type { Mailer } from "./email/mailer";

/** Dépendances injectées : permet de tester le routeur avec une base et un mailer de test. */
export interface Deps {
  pool: pg.Pool;
  mailer: Mailer;
  config: AppConfig;
  now: () => Date;
}
