import { DateTime } from "luxon";
import { HORIZON_DAYS, MIN_LEAD_MIN, SALON_TZ, SLOT_STEP_MIN } from "./rules";

/** Intervalle semi-ouvert [start, end) en millisecondes epoch (UTC). */
export interface Interval {
  start: number;
  end: number;
}

export interface WeeklyHours {
  weekday: number; // 1 = lundi … 7 = dimanche
  start: string; // "HH:mm" heure locale du salon
  end: string;
}

export interface StylistSchedule {
  stylistId: string;
  hours: WeeklyHours[];
  /** Absences et rendez-vous confirmés de ce coiffeur. */
  busy: Interval[];
}

export interface AvailabilityInput {
  fromDate: string; // "YYYY-MM-DD" (date locale, incluse)
  toDate: string; // "YYYY-MM-DD" (date locale, incluse)
  durationMin: number;
  stylists: StylistSchedule[]; // uniquement les coiffeurs habilités pour la prestation
  closures: Interval[];
  now: Date;
  leadMin?: number;
  horizonDays?: number;
}

export interface Slot {
  start: string; // ISO 8601 avec décalage, ex. 2026-12-01T09:30:00+01:00
  stylistIds: string[];
}

export interface DayAvailability {
  date: string;
  slots: Slot[];
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Calcule les créneaux libres jour par jour.
 * Un créneau est proposé si la prestation tient entièrement dans une plage de travail,
 * ne chevauche ni absence, ni fermeture, ni rendez-vous, respecte le délai minimal
 * et l'horizon de réservation, et commence sur la grille de 15 minutes (heure locale).
 * Les conversions passent par le fuseau Europe/Paris pour chaque date : les jours de
 * changement d'heure sont donc gérés.
 */
export function computeAvailability(input: AvailabilityInput): DayAvailability[] {
  const lead = (input.leadMin ?? MIN_LEAD_MIN) * 60_000;
  const horizon = (input.horizonDays ?? HORIZON_DAYS) * 86_400_000;
  const nowMs = input.now.getTime();
  const earliest = nowMs + lead;
  const latest = nowMs + horizon;
  const durMs = input.durationMin * 60_000;

  const days: DayAvailability[] = [];
  let day = DateTime.fromISO(input.fromDate, { zone: SALON_TZ }).startOf("day");
  const last = DateTime.fromISO(input.toDate, { zone: SALON_TZ }).startOf("day");
  if (!day.isValid || !last.isValid) throw new Error("Date invalide");

  while (day <= last) {
    const byStart = new Map<number, string[]>();
    for (const st of input.stylists) {
      for (const h of st.hours.filter((x) => x.weekday === day.weekday)) {
        const windowStart = localTime(day, h.start);
        const windowEnd = localTime(day, h.end).toMillis();
        let t = alignToGrid(windowStart);
        while (t.toMillis() + durMs <= windowEnd) {
          const ms = t.toMillis();
          const slot = { start: ms, end: ms + durMs };
          const free =
            ms >= earliest &&
            ms <= latest &&
            !input.closures.some((c) => overlaps(c, slot)) &&
            !st.busy.some((b) => overlaps(b, slot));
          if (free) {
            const list = byStart.get(ms) ?? [];
            if (!list.includes(st.stylistId)) list.push(st.stylistId);
            byStart.set(ms, list);
          }
          t = t.plus({ minutes: SLOT_STEP_MIN });
        }
      }
    }
    const slots = [...byStart.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ms, ids]) => ({ start: toIso(ms), stylistIds: ids }));
    days.push({ date: day.toISODate()!, slots });
    day = day.plus({ days: 1 });
  }
  return days;
}

function localTime(day: DateTime, hhmm: string): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h ?? 0, minute: m ?? 0, second: 0, millisecond: 0 });
}

function alignToGrid(t: DateTime): DateTime {
  const rem = t.minute % SLOT_STEP_MIN;
  return rem === 0 ? t : t.plus({ minutes: SLOT_STEP_MIN - rem });
}

export function toIso(ms: number): string {
  return DateTime.fromMillis(ms, { zone: SALON_TZ }).toISO({ suppressMilliseconds: true })!;
}

/** Date locale du salon (YYYY-MM-DD) d'un instant. */
export function salonDate(d: Date | number): string {
  return DateTime.fromMillis(typeof d === "number" ? d : d.getTime(), { zone: SALON_TZ }).toISODate()!;
}
