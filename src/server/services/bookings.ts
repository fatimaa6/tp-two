import { DateTime } from "luxon";
import { z } from "zod";
import { salonDate } from "../domain/availability";
import { canClientCancel, checkStart, orderByLoad } from "../domain/booking";
import { MAX_FUTURE_BOOKINGS_PER_EMAIL, PRIVACY_NOTICE_VERSION, SALON_TZ } from "../domain/rules";
import { withTransaction } from "../db/pool";
import type { Deps } from "../deps";
import {
  cancellationEmail,
  confirmationEmail,
  manageUrl,
  salonCancellationNotice,
  type BookingMailData,
} from "../email/templates";
import type { EmailMessage } from "../email/mailer";
import { HttpError } from "../http/http";
import { logEvent } from "../log";
import { randomToken, sha256 } from "../security";
import { getAvailability } from "./availability";

export const bookingInput = z
  .object({
    serviceId: z.string().uuid(),
    stylistId: z.string().uuid().nullable(),
    start: z.string().datetime({ offset: true }),
    customer: z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().trim().toLowerCase().email().max(254),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[0-9 .-]{8,20}$/)
          .optional()
          .or(z.literal("").transform(() => undefined)),
      })
      .strict(),
    note: z.string().trim().max(500).optional(),
    privacyNoticeVersion: z.string().max(20),
    website: z.string().max(0, "Champ anti-robot rempli").optional(), // pot de miel
  })
  .strict();

export type BookingInput = z.infer<typeof bookingInput>;

const EXCLUSION_VIOLATION = "23P01";

export async function createBooking(deps: Deps, input: BookingInput) {
  const now = deps.now();
  const start = new Date(input.start);
  const check = checkStart(start, now);
  if (!check.ok) {
    const messages = {
      not_on_grid: "L'heure doit tomber sur un quart d'heure.",
      too_soon: "Réservez au moins 2 heures à l'avance.",
      too_far: "Réservez au plus 90 jours à l'avance.",
    };
    throw new HttpError(422, check.code, messages[check.code]);
  }
  if (input.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    throw new HttpError(422, "stale_privacy_notice", "Veuillez recharger la page.");
  }

  const day = salonDate(start);
  const avail = await getAvailability(deps.pool, {
    serviceId: input.serviceId,
    stylistId: input.stylistId,
    from: day,
    to: day,
    now,
  });
  const slot = avail.days[0]?.slots.find((s) => new Date(s.start).getTime() === start.getTime());
  if (!slot)
    throw new HttpError(409, "slot_taken", "Ce créneau n'est plus disponible. Choisissez-en un autre.");

  const token = randomToken();
  const service = avail.service;
  const end = new Date(start.getTime() + service.duration_min * 60_000);

  const created = await withTransaction(deps.pool, async (c) => {
    // Sérialise les réservations d'une même adresse pour appliquer BR-07 sans course.
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.customer.email]);
    const { rows: countRows } = await c.query<{ n: string }>(
      "SELECT count(*) AS n FROM bookings WHERE lower(customer_email)=$1 AND status='confirmed' AND starts_at > $2",
      [input.customer.email, now],
    );
    if (Number(countRows[0]?.n ?? 0) >= MAX_FUTURE_BOOKINGS_PER_EMAIL) {
      throw new HttpError(
        409,
        "too_many_bookings",
        `Vous avez déjà ${MAX_FUTURE_BOOKINGS_PER_EMAIL} rendez-vous à venir. Appelez le salon pour en ajouter.`,
      );
    }

    let candidates = slot.stylistIds;
    if (!input.stylistId && candidates.length > 1) {
      const dayStart = DateTime.fromISO(day, { zone: SALON_TZ }).startOf("day");
      const { rows: loads } = await c.query<{ stylist_id: string; n: string }>(
        `SELECT stylist_id, count(*) AS n FROM bookings
         WHERE stylist_id = ANY($1) AND status='confirmed' AND starts_at >= $2 AND starts_at < $3
         GROUP BY stylist_id`,
        [candidates, dayStart.toJSDate(), dayStart.plus({ days: 1 }).toJSDate()],
      );
      candidates = orderByLoad(
        candidates.map((id) => ({
          stylistId: id,
          bookingsThatDay: Number(loads.find((l) => l.stylist_id === id)?.n ?? 0),
          sortOrder: avail.stylists.find((s) => s.id === id)?.sortOrder ?? 0,
        })),
      );
    }

    // La contrainte d'exclusion de la base est l'arbitre final : on tente chaque coiffeur éligible.
    for (const stylistId of candidates) {
      await c.query("SAVEPOINT try_insert");
      try {
        const { rows } = await c.query<{ id: string }>(
          `INSERT INTO bookings (service_id, stylist_id, starts_at, ends_at, customer_name, customer_email,
             customer_phone, note, service_name, price_cents, duration_min, manage_token_hash, privacy_notice_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [
            service.id,
            stylistId,
            start,
            end,
            input.customer.name,
            input.customer.email,
            input.customer.phone ?? null,
            input.note || null,
            service.name,
            service.price_cents,
            service.duration_min,
            sha256(token),
            input.privacyNoticeVersion,
          ],
        );
        await c.query("RELEASE SAVEPOINT try_insert");
        return { id: rows[0]!.id, stylistId };
      } catch (e) {
        await c.query("ROLLBACK TO SAVEPOINT try_insert");
        if ((e as { code?: string }).code !== EXCLUSION_VIOLATION) throw e;
      }
    }
    throw new HttpError(409, "slot_taken", "Ce créneau vient d'être réservé. Choisissez-en un autre.");
  });

  const stylist = avail.stylists.find((s) => s.id === created.stylistId)!;
  const link = manageUrl(deps.config.appBaseUrl, token);
  const mail: BookingMailData = {
    customerName: input.customer.name,
    serviceName: service.name,
    stylistName: stylist.name,
    startsAt: start,
    priceCents: service.price_cents,
    durationMin: service.duration_min,
  };
  await sendLogged(deps, created.id, "confirmation", confirmationEmail(input.customer.email, mail, link));

  return {
    id: created.id,
    status: "confirmed",
    startsAt: slot.start,
    endsAt: DateTime.fromJSDate(end, { zone: SALON_TZ }).toISO({ suppressMilliseconds: true }),
    service: {
      id: service.id,
      name: service.name,
      priceCents: service.price_cents,
      durationMin: service.duration_min,
    },
    stylist: { id: stylist.id, name: stylist.name },
    manageUrl: link,
  };
}

/** Envoie un e-mail sans jamais faire échouer l'opération métier ; trace le résultat dans email_log. */
export async function sendLogged(
  deps: Deps,
  bookingId: string | null,
  kind: string,
  msg: EmailMessage,
): Promise<boolean> {
  try {
    const status = await deps.mailer.send(msg);
    await deps.pool.query("INSERT INTO email_log (booking_id, kind, status) VALUES ($1,$2,$3)", [
      bookingId,
      kind,
      status,
    ]);
    return true;
  } catch (e) {
    logEvent("error", "email.failed", { kind, bookingId, error: (e as Error).message });
    await deps.pool.query(
      "INSERT INTO email_log (booking_id, kind, status, error) VALUES ($1,$2,'failed',$3)",
      [bookingId, kind, (e as Error).message.slice(0, 500)],
    );
    return false;
  }
}

interface BookingRow {
  id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  customer_name: string;
  customer_email: string;
  service_name: string;
  price_cents: number;
  duration_min: number;
  stylist_name: string;
}

const BOOKING_SELECT = `SELECT b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.customer_email,
  b.service_name, b.price_cents, b.duration_min, s.display_name AS stylist_name
  FROM bookings b JOIN stylists s ON s.id = b.stylist_id`;

export const toMailData = (b: BookingRow): BookingMailData => ({
  customerName: b.customer_name,
  serviceName: b.service_name,
  stylistName: b.stylist_name,
  startsAt: b.starts_at,
  priceCents: b.price_cents,
  durationMin: b.duration_min,
});

const iso = (d: Date) => DateTime.fromJSDate(d, { zone: SALON_TZ }).toISO({ suppressMilliseconds: true });

export async function getByToken(deps: Deps, token: string) {
  const { rows } = await deps.pool.query<BookingRow>(
    `${BOOKING_SELECT} WHERE b.manage_token_hash=$1 AND b.anonymised_at IS NULL`,
    [sha256(token)],
  );
  const b = rows[0];
  if (!b) throw new HttpError(404, "not_found", "Rendez-vous introuvable.");
  return {
    id: b.id,
    status: b.status,
    startsAt: iso(b.starts_at),
    endsAt: iso(b.ends_at),
    serviceName: b.service_name,
    stylistName: b.stylist_name,
    priceCents: b.price_cents,
    customerName: b.customer_name,
    canCancel: b.status === "confirmed" && canClientCancel(b.starts_at, deps.now()),
  };
}

export async function cancelByToken(deps: Deps, token: string) {
  const booking = await withTransaction(deps.pool, async (c) => {
    const { rows } = await c.query<BookingRow>(
      `${BOOKING_SELECT} WHERE b.manage_token_hash=$1 AND b.anonymised_at IS NULL FOR UPDATE OF b`,
      [sha256(token)],
    );
    const b = rows[0];
    if (!b) throw new HttpError(404, "not_found", "Rendez-vous introuvable.");
    if (b.status !== "confirmed")
      throw new HttpError(409, "not_cancellable", "Ce rendez-vous est déjà annulé ou passé.");
    if (!canClientCancel(b.starts_at, deps.now())) {
      throw new HttpError(
        403,
        "too_late_to_cancel",
        "L'annulation en ligne n'est plus possible à moins de 24 heures. Appelez le salon au 01 23 45 67 89.",
      );
    }
    await c.query("UPDATE bookings SET status='cancelled_by_client', cancelled_at=$2 WHERE id=$1", [
      b.id,
      deps.now(),
    ]);
    return b;
  });
  const data = toMailData(booking);
  await sendLogged(deps, booking.id, "cancellation", cancellationEmail(booking.customer_email, data, false));
  await sendLogged(
    deps,
    booking.id,
    "cancellation_salon",
    salonCancellationNotice(deps.config.salonInbox, data),
  );
  return { id: booking.id, status: "cancelled_by_client" };
}

export async function cancelBySalon(deps: Deps, id: string) {
  const booking = await withTransaction(deps.pool, async (c) => {
    const { rows } = await c.query<BookingRow>(`${BOOKING_SELECT} WHERE b.id=$1 FOR UPDATE OF b`, [id]);
    const b = rows[0];
    if (!b) throw new HttpError(404, "not_found", "Rendez-vous introuvable.");
    if (b.status !== "confirmed")
      throw new HttpError(409, "not_cancellable", "Ce rendez-vous n'est plus confirmé.");
    await c.query("UPDATE bookings SET status='cancelled_by_salon', cancelled_at=$2 WHERE id=$1", [
      id,
      deps.now(),
    ]);
    return b;
  });
  await sendLogged(
    deps,
    booking.id,
    "cancellation",
    cancellationEmail(booking.customer_email, toMailData(booking), true),
  );
  return { id, status: "cancelled_by_salon" };
}
