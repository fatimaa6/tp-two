import { DateTime } from "luxon";
import { CANCEL_LIMIT_HOURS, HORIZON_DAYS, MIN_LEAD_MIN, SALON_TZ, SLOT_STEP_MIN } from "./rules";

export type StartCheck = { ok: true } | { ok: false; code: "not_on_grid" | "too_soon" | "too_far" };

/** BR-04 et BR-05 : début sur la grille de 15 min (heure locale), au moins 2 h à l'avance, au plus 90 jours. */
export function checkStart(start: Date, now: Date): StartCheck {
  const local = DateTime.fromJSDate(start, { zone: SALON_TZ });
  if (local.minute % SLOT_STEP_MIN !== 0 || local.second !== 0 || local.millisecond !== 0) {
    return { ok: false, code: "not_on_grid" };
  }
  const delta = start.getTime() - now.getTime();
  if (delta < MIN_LEAD_MIN * 60_000) return { ok: false, code: "too_soon" };
  if (delta > HORIZON_DAYS * 86_400_000) return { ok: false, code: "too_far" };
  return { ok: true };
}

/** BR-06 : annulation par le client autorisée jusqu'à 24 h avant le début (inclus). */
export function canClientCancel(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= CANCEL_LIMIT_HOURS * 3_600_000;
}

export interface StylistLoad {
  stylistId: string;
  bookingsThatDay: number;
  sortOrder: number;
}

/** BR-03 : « peu importe » → le coiffeur libre le moins chargé ce jour-là ; égalité → ordre d'affichage. */
export function orderByLoad(candidates: StylistLoad[]): string[] {
  return [...candidates]
    .sort((a, b) => a.bookingsThatDay - b.bookingsThatDay || a.sortOrder - b.sortOrder)
    .map((c) => c.stylistId);
}
