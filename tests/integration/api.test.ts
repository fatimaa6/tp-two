import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PRIVACY_NOTICE_VERSION } from "../../src/server/domain/rules";
import { adminRoutes } from "../../src/server/http/router";
import { purgeOldData, sendReminders } from "../../src/server/services/jobs";
import { ADMIN_EMAIL, ADMIN_PASSWORD, paris, setupEnv, type TestEnv } from "./helpers";

let env: TestEnv;
let services: { id: string; slug: string; durationMin: number }[];
let stylists: { id: string; slug: string; serviceIds: string[] }[];
const svc = (slug: string) => services.find((s) => s.slug === slug)!.id;
const sty = (slug: string) => stylists.find((s) => s.slug === slug)!.id;
let ipCounter = 0;

function bookingBody(over: Record<string, unknown> = {}) {
  return {
    serviceId: svc("coupe-homme"),
    stylistId: sty("malik"),
    start: "2026-12-01T10:00:00+01:00",
    customer: { name: "Client Test", email: `client${Math.random().toString(36).slice(2)}@example.com` },
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    ...over,
  };
}
// Chaque réservation de test vient d'une IP différente pour ne pas toucher la limite de débit.
const book = (over: Record<string, unknown> = {}) =>
  env.call("POST", "/bookings", bookingBody(over), { "x-forwarded-for": `10.0.0.${++ipCounter % 250}` });
const tokenFrom = (manageUrl: string) => manageUrl.split("#t=")[1]!;

beforeAll(async () => {
  env = await setupEnv();
  services = await (await env.call("GET", "/services")).json();
  stylists = await (await env.call("GET", "/stylists")).json();
});
afterAll(async () => env.close());
beforeEach(async () => {
  await env.deps.pool.query(
    "TRUNCATE bookings, time_off, closures, rate_limit_events, admin_sessions, email_log, contact_messages",
  );
  env.mailer.sent = [];
  env.clock.now = paris("2026-11-30T08:00");
});

describe("catalogue", () => {
  it("liste les 11 prestations et 3 coiffeurs fictifs", () => {
    expect(services).toHaveLength(11);
    expect(stylists.map((s) => s.slug)).toEqual(["ines", "malik", "camille"]);
  });

  it("schéma : la contrainte d'exclusion existe", async () => {
    const { rows } = await env.deps.pool.query(
      "SELECT conname FROM pg_constraint WHERE conname='bookings_no_overlap'",
    );
    expect(rows).toHaveLength(1);
  });
});

describe("disponibilités", () => {
  it("renvoie des créneaux pour un mardi et rien pour un lundi", async () => {
    const r = await env.call(
      "GET",
      `/availability?serviceId=${svc("coupe-homme")}&from=2026-11-30&to=2026-12-01`,
    );
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.timezone).toBe("Europe/Paris");
    expect(body.days[0].slots).toHaveLength(0);
    expect(body.days[1].slots[0].start).toBe("2026-12-01T09:30:00+01:00");
  });

  it("refuse une période de plus de 42 jours (422)", async () => {
    const r = await env.call(
      "GET",
      `/availability?serviceId=${svc("coupe-homme")}&from=2026-12-01&to=2027-01-20`,
    );
    expect(r.status).toBe(422);
  });

  it("refuse un coiffeur qui ne fait pas la prestation", async () => {
    const r = await env.call(
      "GET",
      `/availability?serviceId=${svc("balayage")}&stylistId=${sty("malik")}&from=2026-12-01&to=2026-12-01`,
    );
    expect(r.status).toBe(422);
  });

  it("retire le créneau après réservation et le rend après annulation (AC-07)", async () => {
    const created = await (await book()).json();
    const q = `/availability?serviceId=${svc("coupe-homme")}&stylistId=${sty("malik")}&from=2026-12-01&to=2026-12-01`;
    const has10 = async () =>
      ((await (await env.call("GET", q)).json()).days[0].slots as { start: string }[]).some((s) =>
        s.start.includes("T10:00"),
      );
    expect(await has10()).toBe(false);
    const r = await env.call("POST", "/manage/booking/cancel", undefined, {
      "x-manage-token": tokenFrom(created.manageUrl),
    });
    expect(r.status).toBe(200);
    expect(await has10()).toBe(true);
  });

  it("une absence du coiffeur supprime ses créneaux", async () => {
    await env.deps.pool.query("INSERT INTO time_off (stylist_id, starts_at, ends_at) VALUES ($1,$2,$3)", [
      sty("malik"),
      paris("2026-12-01T00:00"),
      paris("2026-12-02T00:00"),
    ]);
    const r = await env.call(
      "GET",
      `/availability?serviceId=${svc("coupe-homme")}&stylistId=${sty("malik")}&from=2026-12-01&to=2026-12-01`,
    );
    expect((await r.json()).days[0].slots).toHaveLength(0);
  });
});

describe("réservation", () => {
  it("crée un rendez-vous (201) et envoie la confirmation avec un lien privé (AC-05)", async () => {
    const r = await book();
    expect(r.status).toBe(201);
    const b = await r.json();
    expect(b).toMatchObject({
      status: "confirmed",
      startsAt: "2026-12-01T10:00:00+01:00",
      stylist: { name: "Malik" },
    });
    expect(env.mailer.sent).toHaveLength(1);
    expect(env.mailer.sent[0]!.text).toContain("/gerer#t=");
    const { rows } = await env.deps.pool.query("SELECT manage_token_hash FROM bookings");
    expect(rows[0].manage_token_hash).not.toContain(tokenFrom(b.manageUrl)); // seul le hash est stocké
  });

  it("le rendez-vous est enregistré même si l'e-mail échoue", async () => {
    env.mailer.failNext = true;
    expect((await book()).status).toBe(201);
    const { rows } = await env.deps.pool.query("SELECT status FROM email_log");
    expect(rows[0].status).toBe("failed");
  });

  it("deux demandes simultanées pour le même créneau : exactement une réussit (AC-02)", async () => {
    for (let i = 0; i < 25; i++) {
      await env.deps.pool.query("TRUNCATE bookings, email_log, rate_limit_events");
      const [a, b] = await Promise.all([book(), book()]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect((await loser.json()).error.code).toBe("slot_taken");
      const { rows } = await env.deps.pool.query(
        "SELECT count(*)::int AS n FROM bookings WHERE status='confirmed'",
      );
      expect(rows[0].n).toBe(1);
    }
  });

  it("un chevauchement partiel est aussi refusé par la base", async () => {
    expect((await book({ serviceId: svc("coupe-barbe"), start: "2026-12-01T10:00:00+01:00" })).status).toBe(
      201,
    );
    const r = await book({ start: "2026-12-01T10:30:00+01:00" }); // 10:00–10:45 occupé
    expect(r.status).toBe(409);
  });

  it("« peu importe » : bascule sur un autre coiffeur libre", async () => {
    const a = await (await book({ serviceId: svc("coupe-enfant"), stylistId: null })).json();
    const b = await (await book({ serviceId: svc("coupe-enfant"), stylistId: null })).json();
    expect(a.stylist.name).not.toBe(b.stylist.name);
    const c = await book({ serviceId: svc("coupe-enfant"), stylistId: null });
    expect(c.status).toBe(409); // Malik et Camille sont pris
  });

  it("limite de 3 rendez-vous à venir par adresse e-mail (BR-07)", async () => {
    const customer = { name: "Même Personne", email: "meme@example.com" };
    for (const t of ["09:30", "10:00", "10:30"]) {
      expect((await book({ customer, start: `2026-12-01T${t}:00+01:00` })).status).toBe(201);
    }
    const r = await book({
      customer: { ...customer, email: "MEME@example.com" },
      start: "2026-12-01T11:00:00+01:00",
    });
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("too_many_bookings");
  });

  it("refuse moins de 2 h à l'avance, hors grille, et hors horaires (422/409)", async () => {
    env.clock.now = paris("2026-12-01T09:00");
    expect((await book({ start: "2026-12-01T10:00:00+01:00" })).status).toBe(422);
    expect((await book({ start: "2026-12-01T15:10:00+01:00" })).status).toBe(422);
    expect((await book({ start: "2026-12-01T13:30:00+01:00" })).status).toBe(409); // pause déjeuner
  });

  it("valide les entrées : champ inconnu, e-mail invalide, pot de miel, JSON obligatoire", async () => {
    expect((await book({ admin: true })).status).toBe(422);
    expect((await book({ customer: { name: "A B", email: "pas-un-email" } })).status).toBe(422);
    expect((await book({ website: "spam" })).status).toBe(422);
    const r = await env.call("POST", "/bookings", undefined, { "content-type": "text/plain" });
    expect(r.status).toBe(415);
  });

  it("limite à 5 réservations par heure et par IP", async () => {
    const h = { "x-forwarded-for": "192.0.2.1" };
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await env.call(
        "POST",
        "/bookings",
        bookingBody({ start: `2026-12-0${2 + (i % 3)}T1${i}:00:00+01:00` }),
        h,
      );
      statuses.push(r.status);
    }
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("gestion par lien privé", () => {
  it("affiche le rendez-vous, refuse un jeton inconnu (404)", async () => {
    const b = await (await book()).json();
    const ok = await env.call("GET", "/manage/booking", undefined, {
      "x-manage-token": tokenFrom(b.manageUrl),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).canCancel).toBe(true);
    const bad = await env.call("GET", "/manage/booking", undefined, { "x-manage-token": "A".repeat(43) });
    expect(bad.status).toBe(404);
  });

  it("annulation refusée à moins de 24 h (403), e-mails client + salon sinon", async () => {
    const b = await (await book()).json();
    const token = tokenFrom(b.manageUrl);
    env.clock.now = paris("2026-11-30T10:01");
    const late = await env.call("POST", "/manage/booking/cancel", undefined, { "x-manage-token": token });
    expect(late.status).toBe(403);
    expect((await late.json()).error.code).toBe("too_late_to_cancel");
    env.clock.now = paris("2026-11-30T09:59");
    env.mailer.sent = [];
    expect(
      (await env.call("POST", "/manage/booking/cancel", undefined, { "x-manage-token": token })).status,
    ).toBe(200);
    expect(env.mailer.sent.map((m) => m.to)).toContain("salon@example.com");
    expect(
      (await env.call("POST", "/manage/booking/cancel", undefined, { "x-manage-token": token })).status,
    ).toBe(409);
  });
});

describe("administration (AC-08)", () => {
  async function loginCookie() {
    const r = await env.call(
      "POST",
      "/admin/session",
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      { "x-forwarded-for": "198.51.100.9" },
    );
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^__Host-sillage_admin=.+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    return cookie.split(";")[0]!;
  }

  it("toutes les routes admin répondent 401 sans session", async () => {
    const uuid = "00000000-0000-4000-8000-000000000000";
    const routes = adminRoutes();
    expect(routes.length).toBeGreaterThan(8);
    for (const r of routes) {
      const path = r.pattern.source
        .replace(/^\^/, "")
        .replace(/\$$/, "")
        .replace("([0-9a-fA-F-]{36})", uuid)
        .replace(/\\\//g, "/");
      const res = await env.call(r.method, path, ["POST"].includes(r.method) ? {} : undefined);
      expect(res.status, `${r.method} ${path}`).toBe(401);
      const forged = await env.call(r.method, path, ["POST"].includes(r.method) ? {} : undefined, {
        cookie: "__Host-sillage_admin=faux",
      });
      expect(forged.status, `${r.method} ${path} (faux cookie)`).toBe(401);
    }
  });

  it("6e tentative après 5 échecs en 15 min : 429, même avec le bon mot de passe", async () => {
    const h = { "x-forwarded-for": "203.0.113.5" };
    for (let i = 0; i < 5; i++) {
      const r = await env.call(
        "POST",
        "/admin/session",
        { email: ADMIN_EMAIL, password: "mauvais-mot-de-passe" },
        h,
      );
      expect(r.status).toBe(401);
      expect((await r.json()).error.message).toBe("E-mail ou mot de passe incorrect.");
    }
    const sixth = await env.call(
      "POST",
      "/admin/session",
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      h,
    );
    expect(sixth.status).toBe(429);
    env.clock.now = new Date(env.clock.now.getTime() + 16 * 60_000);
    expect(
      (await env.call("POST", "/admin/session", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, h)).status,
    ).toBe(200);
  });

  it("agenda, annulation par le salon, absences, fermetures, déconnexion", async () => {
    const cookie = await loginCookie();
    const H = { cookie };
    const b = await (await book()).json();
    const agenda = await (
      await env.call("GET", "/admin/bookings?from=2026-12-01&to=2026-12-07", undefined, H)
    ).json();
    expect(agenda).toHaveLength(1);
    expect(agenda[0].customerName).toBe("Client Test");

    env.mailer.sent = [];
    expect((await env.call("POST", `/admin/bookings/${b.id}/cancel`, undefined, H)).status).toBe(200);
    expect(env.mailer.sent[0]!.text).toContain("Le salon a dû annuler");

    const off = await env.call(
      "POST",
      "/admin/time-off",
      {
        stylistId: sty("ines"),
        startsAt: "2026-12-02T00:00",
        endsAt: "2026-12-03T00:00",
        reason: "Formation",
      },
      H,
    );
    expect(off.status).toBe(201);
    expect(await (await env.call("GET", "/admin/time-off", undefined, H)).json()).toHaveLength(1);
    const badOff = await env.call(
      "POST",
      "/admin/time-off",
      { stylistId: sty("ines"), startsAt: "2026-12-03T00:00", endsAt: "2026-12-02T00:00" },
      H,
    );
    expect(badOff.status).toBe(422);

    const cl = await env.call(
      "POST",
      "/admin/closures",
      { startsAt: "2026-12-24T00:00", endsAt: "2026-12-27T00:00", reason: "Noël" },
      H,
    );
    expect(cl.status).toBe(201);
    const avail = await (
      await env.call("GET", `/availability?serviceId=${svc("coupe-homme")}&from=2026-12-24&to=2026-12-26`)
    ).json();
    expect(avail.days.every((d: { slots: unknown[] }) => d.slots.length === 0)).toBe(true);
    const { id } = await cl.json();
    expect((await env.call("DELETE", `/admin/closures/${id}`, undefined, H)).status).toBe(204);

    expect((await env.call("DELETE", "/admin/session", undefined, H)).status).toBe(200);
    expect((await env.call("GET", "/admin/me", undefined, H)).status).toBe(401);
  });

  it("refuse une requête qui modifie l'état depuis une autre origine (CSRF)", async () => {
    const cookie = await loginCookie();
    const r = await env.call(
      "POST",
      "/admin/closures",
      { startsAt: "2026-12-24T00:00", endsAt: "2026-12-25T00:00" },
      { cookie, origin: "https://evil.example" },
    );
    expect(r.status).toBe(403);
  });
});

describe("tâches planifiées", () => {
  it("rappel envoyé une seule fois même si la tâche tourne deux fois (AC-06)", async () => {
    await book(); // mardi 10:00
    env.clock.now = paris("2026-11-30T11:00"); // J-23 h, dans la fenêtre 20–26 h
    env.mailer.sent = [];
    expect(await sendReminders(env.deps)).toEqual({ candidates: 1, sent: 1 });
    expect(await sendReminders(env.deps)).toEqual({ candidates: 0, sent: 0 });
    expect(env.mailer.sent).toHaveLength(1);
    expect(env.mailer.sent[0]!.subject).toContain("Rappel");
  });

  it("un rappel en échec est retenté à l'exécution suivante", async () => {
    await book();
    env.clock.now = paris("2026-11-30T11:00");
    env.mailer.failNext = true;
    expect((await sendReminders(env.deps)).sent).toBe(0);
    expect((await sendReminders(env.deps)).sent).toBe(1);
  });

  it("purge : anonymise après 12 mois, supprime les messages de plus de 90 jours", async () => {
    await book();
    await env.deps.pool.query(
      "INSERT INTO contact_messages (name, email, message, created_at) VALUES ('A','a@example.com','Bonjour', $1)",
      [paris("2026-08-01T10:00")],
    );
    env.clock.now = paris("2027-12-02T10:00");
    expect(await purgeOldData(env.deps)).toEqual({ anonymised: 1, contactsDeleted: 1 });
    const { rows } = await env.deps.pool.query("SELECT customer_email FROM bookings");
    expect(rows[0].customer_email).toBe("anonyme@invalid");
  });
});

describe("contact et santé", () => {
  it("le formulaire de contact enregistre et prévient le salon", async () => {
    const r = await env.call("POST", "/contact", {
      name: "Léa",
      email: "lea@example.com",
      message: "Avez-vous des créneaux le soir ?",
    });
    expect(r.status).toBe(202);
    expect(env.mailer.sent[0]!.to).toBe("salon@example.com");
  });
  it("/readyz vérifie la base", async () => expect((await env.call("GET", "/readyz")).status).toBe(200));
  it("route inconnue → 404 au format d'erreur commun", async () => {
    const r = await env.call("GET", "/nope");
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe("not_found");
  });
});
