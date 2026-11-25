import { DateTime } from "luxon";
import { z } from "zod";
import { SALON_TZ } from "../domain/rules";
import type { Deps } from "../deps";
import { HttpError } from "../http/http";

const iso = (d: Date) => DateTime.fromJSDate(d, { zone: SALON_TZ }).toISO({ suppressMilliseconds: true });

/** "YYYY-MM-DDTHH:mm" saisi dans l'admin = heure locale du salon. */
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((s, ctx) => {
    const d = DateTime.fromISO(s, { zone: SALON_TZ });
    if (!d.isValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date invalide" });
      return z.NEVER;
    }
    return d.toJSDate();
  });

export const periodInput = z
  .object({
    startsAt: localDateTime,
    endsAt: localDateTime,
    reason: z.string().trim().max(200).default(""),
  })
  .strict()
  .refine((v) => v.endsAt > v.startsAt, { message: "La fin doit être après le début", path: ["endsAt"] });

export const timeOffInput = z
  .object({ stylistId: z.string().uuid() })
  .merge(
    z.object({
      startsAt: localDateTime,
      endsAt: localDateTime,
      reason: z.string().trim().max(200).default(""),
    }),
  )
  .strict()
  .refine((v) => v.endsAt > v.startsAt, { message: "La fin doit être après le début", path: ["endsAt"] });

export async function listBookings(deps: Deps, from: string, to: string) {
  const start = DateTime.fromISO(from, { zone: SALON_TZ });
  const end = DateTime.fromISO(to, { zone: SALON_TZ });
  if (!start.isValid || !end.isValid || end < start || end.diff(start, "days").days > 62) {
    throw new HttpError(422, "invalid_range", "Période invalide (62 jours maximum).");
  }
  const { rows } = await deps.pool.query<{
    id: string;
    status: string;
    starts_at: Date;
    ends_at: Date;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    note: string | null;
    service_name: string;
    price_cents: number;
    stylist_name: string;
    stylist_id: string;
  }>(
    `SELECT b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.customer_email, b.customer_phone, b.note,
            b.service_name, b.price_cents, s.display_name AS stylist_name, s.id AS stylist_id
     FROM bookings b JOIN stylists s ON s.id = b.stylist_id
     WHERE b.starts_at >= $1 AND b.starts_at < $2 ORDER BY b.starts_at`,
    [start.startOf("day").toJSDate(), end.plus({ days: 1 }).startOf("day").toJSDate()],
  );
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    note: r.note,
    serviceName: r.service_name,
    priceCents: r.price_cents,
    stylistName: r.stylist_name,
    stylistId: r.stylist_id,
  }));
}

export async function listTimeOff(deps: Deps) {
  const { rows } = await deps.pool.query<{
    id: string;
    stylist_id: string;
    stylist_name: string;
    starts_at: Date;
    ends_at: Date;
    reason: string;
  }>(
    `SELECT t.id, t.stylist_id, s.display_name AS stylist_name, t.starts_at, t.ends_at, t.reason
     FROM time_off t JOIN stylists s ON s.id = t.stylist_id WHERE t.ends_at > $1 ORDER BY t.starts_at`,
    [deps.now()],
  );
  return rows.map((r) => ({
    id: r.id,
    stylistId: r.stylist_id,
    stylistName: r.stylist_name,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    reason: r.reason,
  }));
}

export async function addTimeOff(deps: Deps, v: z.infer<typeof timeOffInput>) {
  const { rows } = await deps.pool.query<{ id: string }>(
    "INSERT INTO time_off (stylist_id, starts_at, ends_at, reason) VALUES ($1,$2,$3,$4) RETURNING id",
    [v.stylistId, v.startsAt, v.endsAt, v.reason],
  );
  return { id: rows[0]!.id };
}

export async function deleteTimeOff(deps: Deps, id: string) {
  const { rowCount } = await deps.pool.query("DELETE FROM time_off WHERE id=$1", [id]);
  if (!rowCount) throw new HttpError(404, "not_found", "Absence introuvable.");
}

export async function listClosures(deps: Deps) {
  const { rows } = await deps.pool.query<{ id: string; starts_at: Date; ends_at: Date; reason: string }>(
    "SELECT id, starts_at, ends_at, reason FROM closures WHERE ends_at > $1 ORDER BY starts_at",
    [deps.now()],
  );
  return rows.map((r) => ({
    id: r.id,
    startsAt: iso(r.starts_at),
    endsAt: iso(r.ends_at),
    reason: r.reason,
  }));
}

export async function addClosure(deps: Deps, v: z.infer<typeof periodInput>) {
  const { rows } = await deps.pool.query<{ id: string }>(
    "INSERT INTO closures (starts_at, ends_at, reason) VALUES ($1,$2,$3) RETURNING id",
    [v.startsAt, v.endsAt, v.reason],
  );
  return { id: rows[0]!.id };
}

export async function deleteClosure(deps: Deps, id: string) {
  const { rowCount } = await deps.pool.query("DELETE FROM closures WHERE id=$1", [id]);
  if (!rowCount) throw new HttpError(404, "not_found", "Fermeture introuvable.");
}
