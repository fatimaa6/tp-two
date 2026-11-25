import type { Deps } from "../deps";
import { HttpError, getCookie } from "../http/http";
import { randomToken, safeEqual, sha256, verifyPassword } from "../security";
import { countRecent, record } from "./rateLimit";

export const SESSION_COOKIE = "__Host-sillage_admin";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const WINDOW_MIN = 15;

/** Connexion de l'administrateur unique. 5 échecs en 15 min (par IP ou par e-mail) → 429. */
export async function login(deps: Deps, email: string, password: string, ip: string) {
  const now = deps.now();
  const normalized = email.trim().toLowerCase();
  const keys = [`login:ip:${ip}`, `login:email:${sha256(normalized)}`];
  for (const key of keys) {
    if ((await countRecent(deps.pool, key, WINDOW_MIN, now)) >= MAX_FAILURES) {
      throw new HttpError(429, "rate_limited", "Trop de tentatives. Réessayez dans 15 minutes.");
    }
  }
  // Le mot de passe est toujours vérifié, même si l'e-mail est faux : même durée de réponse.
  const passwordOk = await verifyPassword(password, deps.config.adminPasswordHash);
  const emailOk = safeEqual(normalized, deps.config.adminEmail);
  if (!passwordOk || !emailOk) {
    for (const key of keys) await record(deps.pool, key, now);
    throw new HttpError(401, "invalid_credentials", "E-mail ou mot de passe incorrect.");
  }
  const sessionId = randomToken();
  const expires = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  await deps.pool.query("INSERT INTO admin_sessions (id_hash, created_at, expires_at) VALUES ($1,$2,$3)", [
    sha256(sessionId),
    now,
    expires,
  ]);
  return {
    cookie: `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`,
  };
}

export async function logout(deps: Deps, req: Request) {
  const sid = getCookie(req, SESSION_COOKIE);
  if (sid) await deps.pool.query("DELETE FROM admin_sessions WHERE id_hash=$1", [sha256(sid)]);
  return { cookie: `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` };
}

/** Garde de toutes les routes /api/admin/* (sauf la connexion). */
export async function requireAdmin(deps: Deps, req: Request): Promise<void> {
  const sid = getCookie(req, SESSION_COOKIE);
  if (!sid) throw new HttpError(401, "unauthenticated", "Connexion requise.");
  const { rowCount } = await deps.pool.query(
    "SELECT 1 FROM admin_sessions WHERE id_hash=$1 AND expires_at > $2",
    [sha256(sid), deps.now()],
  );
  if (!rowCount) throw new HttpError(401, "unauthenticated", "Session expirée. Reconnectez-vous.");
}
