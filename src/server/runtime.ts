import { loadConfig } from "./config";
import { getPool } from "./db/pool";
import type { Deps } from "./deps";
import { LogMailer, SmtpMailer, type Mailer } from "./email/mailer";

let deps: Deps | undefined;

/** Dépendances de production, créées une fois par instance de fonction. */
export function getDeps(): Deps {
  if (!deps) {
    const config = loadConfig();
    const mailer: Mailer = config.mailMode === "smtp" ? new SmtpMailer(config) : new LogMailer();
    deps = { config, pool: getPool(config.databaseUrl), mailer, now: () => new Date() };
  }
  return deps;
}
