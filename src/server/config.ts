/** Configuration lue depuis les variables d'environnement, validée au premier accès. */
export interface AppConfig {
  env: "development" | "test" | "staging" | "production";
  databaseUrl: string;
  appBaseUrl: string;
  adminEmail: string;
  adminPasswordHash: string;
  mailMode: "smtp" | "log";
  smtp: { host: string; port: number; user: string; pass: string };
  mailFrom: string;
  salonInbox: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const env = (process.env.APP_ENV ?? "development") as AppConfig["env"];
  const mailMode = (process.env.MAIL_MODE ?? "smtp") as AppConfig["mailMode"];
  const cfg: AppConfig = {
    env,
    databaseUrl: required("DATABASE_URL"),
    appBaseUrl: required("APP_BASE_URL").replace(/\/$/, ""),
    adminEmail: required("ADMIN_EMAIL").toLowerCase(),
    adminPasswordHash: required("ADMIN_PASSWORD_HASH"),
    mailMode,
    smtp: {
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      user: mailMode === "smtp" ? required("SMTP_USER") : "",
      pass: mailMode === "smtp" ? required("SMTP_PASS") : "",
    },
    mailFrom: process.env.MAIL_FROM ?? "Studio Sillage <no-reply@example.com>",
    salonInbox: process.env.SALON_INBOX ?? "salon@example.com",
  };
  if (env === "production" && !cfg.adminPasswordHash.startsWith("scrypt$")) {
    throw new Error("ADMIN_PASSWORD_HASH invalide en production");
  }
  cached = cfg;
  return cfg;
}
