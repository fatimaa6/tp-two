import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Deps } from "../deps";
import { contactEmail } from "../email/templates";
import { logEvent } from "../log";
import * as admin from "../services/admin";
import { login, logout, requireAdmin } from "../services/auth";
import {
  bookingInput,
  cancelBySalon,
  cancelByToken,
  createBooking,
  getByToken,
  sendLogged,
} from "../services/bookings";
import { getAvailability } from "../services/availability";
import { listServices, listStylists } from "../services/catalog";
import { enforce } from "../services/rateLimit";
import { HttpError, clientIp, errorResponse, json, parse, readJson } from "./http";

type Handler = (ctx: Ctx) => Promise<Response>;
interface Ctx {
  req: Request;
  deps: Deps;
  params: Record<string, string>;
  url: URL;
}
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  admin: boolean;
  handler: Handler;
}

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler, opts: { admin?: boolean } = {}) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:([a-zA-Z]+)/g, (_m, k: string) => (keys.push(k), "([0-9a-fA-F-]{36})")) + "$",
  );
  routes.push({ method, pattern, keys, admin: opts.admin ?? false, handler });
}

/** Liste des routes admin, exposée pour le test de la matrice d'autorisation. */
export const adminRoutes = () =>
  routes.filter((r) => r.admin).map((r) => ({ method: r.method, pattern: r.pattern }));

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const manageToken = (req: Request) => {
  const t = req.headers.get("x-manage-token");
  if (!t || !/^[A-Za-z0-9_-]{43}$/.test(t)) throw new HttpError(404, "not_found", "Rendez-vous introuvable.");
  return t;
};

// ---------- Public ----------
route("GET", "/services", async ({ deps }) =>
  json(200, await listServices(deps.pool), { "cache-control": "public, max-age=300" }),
);
route("GET", "/stylists", async ({ deps }) =>
  json(200, await listStylists(deps.pool), { "cache-control": "public, max-age=300" }),
);
route("GET", "/availability", async ({ deps, url }) => {
  const q = parse(
    z.object({ serviceId: uuid, stylistId: uuid.optional(), from: dateParam, to: dateParam }).strict(),
    Object.fromEntries(url.searchParams),
  );
  const r = await getAvailability(deps.pool, { ...q, now: deps.now() });
  return json(200, { timezone: r.timezone, durationMin: r.service.duration_min, days: r.days });
});
route("POST", "/bookings", async ({ req, deps }) => {
  const input = await readJson(req, bookingInput);
  await enforce(deps.pool, `booking:${clientIp(req)}`, 5, 60, deps.now());
  return json(201, await createBooking(deps, input));
});
route("GET", "/manage/booking", async ({ req, deps }) => json(200, await getByToken(deps, manageToken(req))));
route("POST", "/manage/booking/cancel", async ({ req, deps }) =>
  json(200, await cancelByToken(deps, manageToken(req))),
);
route("POST", "/contact", async ({ req, deps }) => {
  const m = await readJson(
    req,
    z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(254),
        message: z.string().trim().min(5).max(2000),
        website: z.string().max(0).optional(),
      })
      .strict(),
  );
  await enforce(deps.pool, `contact:${clientIp(req)}`, 5, 60, deps.now());
  await deps.pool.query("INSERT INTO contact_messages (name, email, message) VALUES ($1,$2,$3)", [
    m.name,
    m.email,
    m.message,
  ]);
  await sendLogged(deps, null, "contact", contactEmail(deps.config.salonInbox, m));
  return json(202, { ok: true });
});
route("GET", "/healthz", async () => json(200, { ok: true }));
route("GET", "/readyz", async ({ deps }) => {
  await deps.pool.query("SELECT 1");
  return json(200, { ok: true, version: process.env.COMMIT_REF?.slice(0, 7) ?? "local" });
});

// ---------- Admin ----------
route("POST", "/admin/session", async ({ req, deps }) => {
  const b = await readJson(
    req,
    z.object({ email: z.string().max(254), password: z.string().max(200) }).strict(),
  );
  const { cookie } = await login(deps, b.email, b.password, clientIp(req));
  return json(200, { ok: true }, { "set-cookie": cookie });
});
route(
  "DELETE",
  "/admin/session",
  async ({ req, deps }) => json(200, { ok: true }, { "set-cookie": (await logout(deps, req)).cookie }),
  { admin: true },
);
route("GET", "/admin/me", async ({ deps }) => json(200, { email: deps.config.adminEmail }), { admin: true });
route(
  "GET",
  "/admin/bookings",
  async ({ deps, url }) => {
    const q = parse(
      z.object({ from: dateParam, to: dateParam }).strict(),
      Object.fromEntries(url.searchParams),
    );
    return json(200, await admin.listBookings(deps, q.from, q.to));
  },
  { admin: true },
);
route(
  "POST",
  "/admin/bookings/:id/cancel",
  async ({ deps, params }) => json(200, await cancelBySalon(deps, params.id!)),
  {
    admin: true,
  },
);
route("GET", "/admin/stylists", async ({ deps }) => json(200, await listStylists(deps.pool)), {
  admin: true,
});
route("GET", "/admin/time-off", async ({ deps }) => json(200, await admin.listTimeOff(deps)), {
  admin: true,
});
route(
  "POST",
  "/admin/time-off",
  async ({ req, deps }) => json(201, await admin.addTimeOff(deps, await readJson(req, admin.timeOffInput))),
  { admin: true },
);
route(
  "DELETE",
  "/admin/time-off/:id",
  async ({ deps, params }) => {
    await admin.deleteTimeOff(deps, params.id!);
    return json(204, null);
  },
  { admin: true },
);
route("GET", "/admin/closures", async ({ deps }) => json(200, await admin.listClosures(deps)), {
  admin: true,
});
route(
  "POST",
  "/admin/closures",
  async ({ req, deps }) => json(201, await admin.addClosure(deps, await readJson(req, admin.periodInput))),
  { admin: true },
);
route(
  "DELETE",
  "/admin/closures/:id",
  async ({ deps, params }) => {
    await admin.deleteClosure(deps, params.id!);
    return json(204, null);
  },
  { admin: true },
);

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Point d'entrée unique de l'API : /api/<route>. */
export async function handle(req: Request, deps: Deps): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "").replace(/\/$/, "") || "/";
  const started = Date.now();
  let status = 500;
  try {
    // Défense CSRF : en plus de SameSite et du JSON obligatoire, l'Origin doit être le site lui-même.
    if (STATE_CHANGING.has(req.method)) {
      const origin = req.headers.get("origin");
      if (origin && origin !== new URL(deps.config.appBaseUrl).origin) {
        throw new HttpError(403, "bad_origin", "Origine non autorisée.");
      }
    }
    const candidates = routes.filter((r) => r.pattern.test(path));
    if (candidates.length === 0) throw new HttpError(404, "not_found", "Route inconnue.");
    const r = candidates.find((c) => c.method === req.method);
    if (!r) throw new HttpError(405, "method_not_allowed", "Méthode non autorisée.");
    if (r.admin) await requireAdmin(deps, req);
    const match = path.match(r.pattern)!;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, match[i + 1]!]));
    const res = await r.handler({ req, deps, params, url });
    res.headers.set("x-request-id", requestId);
    status = res.status;
    return res;
  } catch (e) {
    if (e instanceof HttpError) {
      status = e.status;
      return errorResponse(e, requestId);
    }
    logEvent("error", "api.unhandled", { requestId, path, error: (e as Error).message });
    return errorResponse(
      new HttpError(500, "internal_error", "Une erreur est survenue. Réessayez."),
      requestId,
    );
  } finally {
    logEvent("info", "api.request", {
      requestId,
      method: req.method,
      path,
      status,
      ms: Date.now() - started,
    });
  }
}
