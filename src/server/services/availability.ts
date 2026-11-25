import { DateTime } from "luxon";
import type pg from "pg";
import {
  computeAvailability,
  type Interval,
  type StylistSchedule,
  type WeeklyHours,
} from "../domain/availability";
import { MAX_AVAILABILITY_RANGE_DAYS, SALON_TZ } from "../domain/rules";
import { HttpError } from "../http/http";

export interface AvailabilityQuery {
  serviceId: string;
  stylistId?: string | null;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  now: Date;
}

export interface EligibleStylist {
  id: string;
  name: string;
  sortOrder: number;
}

export async function loadService(db: pg.Pool | pg.PoolClient, serviceId: string) {
  const { rows } = await db.query<{ id: string; name: string; duration_min: number; price_cents: number }>(
    "SELECT id, name, duration_min, price_cents FROM services WHERE id=$1 AND is_active",
    [serviceId],
  );
  const s = rows[0];
  if (!s) throw new HttpError(404, "service_not_found", "Prestation introuvable.");
  return s;
}

export async function eligibleStylists(
  db: pg.Pool | pg.PoolClient,
  serviceId: string,
  stylistId?: string | null,
): Promise<EligibleStylist[]> {
  const { rows } = await db.query<{ id: string; display_name: string; sort_order: number }>(
    `SELECT s.id, s.display_name, s.sort_order FROM stylists s
     JOIN stylist_services ss ON ss.stylist_id = s.id
     WHERE ss.service_id = $1 AND s.is_active AND ($2::uuid IS NULL OR s.id = $2::uuid)
     ORDER BY s.sort_order`,
    [serviceId, stylistId ?? null],
  );
  if (stylistId && rows.length === 0) {
    throw new HttpError(422, "stylist_not_eligible", "Ce coiffeur ne réalise pas cette prestation.");
  }
  return rows.map((r) => ({ id: r.id, name: r.display_name, sortOrder: r.sort_order }));
}

/** Charge horaires, absences, fermetures et rendez-vous, puis calcule les créneaux (lecture seule, indicatif). */
export async function getAvailability(db: pg.Pool | pg.PoolClient, q: AvailabilityQuery) {
  const from = DateTime.fromISO(q.from, { zone: SALON_TZ });
  const to = DateTime.fromISO(q.to, { zone: SALON_TZ });
  if (!from.isValid || !to.isValid || to < from) {
    throw new HttpError(422, "invalid_range", "Période invalide.");
  }
  if (to.diff(from, "days").days >= MAX_AVAILABILITY_RANGE_DAYS) {
    throw new HttpError(
      422,
      "range_too_large",
      `La période est limitée à ${MAX_AVAILABILITY_RANGE_DAYS} jours.`,
    );
  }
  const service = await loadService(db, q.serviceId);
  const stylists = await eligibleStylists(db, q.serviceId, q.stylistId);
  const ids = stylists.map((s) => s.id);
  const rangeStart = from.startOf("day").toJSDate();
  const rangeEnd = to.plus({ days: 1 }).startOf("day").toJSDate();

  const [hours, busy, closures] = await Promise.all([
    db.query<{ stylist_id: string; weekday: number; start_time: string; end_time: string }>(
      "SELECT stylist_id, weekday, start_time, end_time FROM working_hours WHERE stylist_id = ANY($1)",
      [ids],
    ),
    db.query<{ stylist_id: string; starts_at: Date; ends_at: Date }>(
      `SELECT stylist_id, starts_at, ends_at FROM time_off
         WHERE stylist_id = ANY($1) AND starts_at < $3 AND ends_at > $2
       UNION ALL
       SELECT stylist_id, starts_at, ends_at FROM bookings
         WHERE stylist_id = ANY($1) AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2`,
      [ids, rangeStart, rangeEnd],
    ),
    db.query<{ starts_at: Date; ends_at: Date }>(
      "SELECT starts_at, ends_at FROM closures WHERE starts_at < $2 AND ends_at > $1",
      [rangeStart, rangeEnd],
    ),
  ]);

  const schedules: StylistSchedule[] = stylists.map((s) => ({
    stylistId: s.id,
    hours: hours.rows
      .filter((h) => h.stylist_id === s.id)
      .map<WeeklyHours>((h) => ({
        weekday: h.weekday,
        start: h.start_time.slice(0, 5),
        end: h.end_time.slice(0, 5),
      })),
    busy: busy.rows
      .filter((b) => b.stylist_id === s.id)
      .map<Interval>((b) => ({ start: b.starts_at.getTime(), end: b.ends_at.getTime() })),
  }));

  const days = computeAvailability({
    fromDate: from.toISODate()!,
    toDate: to.toISODate()!,
    durationMin: service.duration_min,
    stylists: schedules,
    closures: closures.rows.map((c) => ({ start: c.starts_at.getTime(), end: c.ends_at.getTime() })),
    now: q.now,
  });
  return { timezone: SALON_TZ, service, stylists, days };
}
