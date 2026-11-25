import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { computeAvailability, type StylistSchedule } from "../../src/server/domain/availability";

const Z = "Europe/Paris";
const at = (iso: string) => DateTime.fromISO(iso, { zone: Z }).toMillis();
const weekdays = (start: string, end: string, days = [2, 3, 4, 5]) =>
  days.map((weekday) => ({ weekday, start, end }));

const ines: StylistSchedule = {
  stylistId: "ines",
  hours: [
    ...weekdays("09:30", "13:00"),
    ...weekdays("14:00", "19:00"),
    { weekday: 6, start: "09:00", end: "18:00" },
  ],
  busy: [],
};
// Mardi 1er décembre 2026, maintenant = lundi 30 novembre 8 h.
const NOW = new Date(at("2026-11-30T08:00"));
const run = (over: Partial<Parameters<typeof computeAvailability>[0]> = {}) =>
  computeAvailability({
    fromDate: "2026-12-01",
    toDate: "2026-12-01",
    durationMin: 60,
    stylists: [ines],
    closures: [],
    now: NOW,
    ...over,
  });
const times = (d: ReturnType<typeof run>, i = 0) => d[i]!.slots.map((s) => s.start.slice(11, 16));

describe("computeAvailability", () => {
  it("propose des créneaux tous les quarts d'heure qui tiennent entièrement dans les plages", () => {
    const t = times(run());
    expect(t[0]).toBe("09:30");
    expect(t).toContain("12:00");
    expect(t).not.toContain("12:15"); // 12:15 + 60 min dépasse 13:00
    expect(t).not.toContain("13:30"); // pause déjeuner
    expect(t).toContain("14:00");
    expect(t.at(-1)).toBe("18:00");
    expect(t.every((x) => Number(x.slice(3)) % 15 === 0)).toBe(true);
  });

  it("n'offre pas une prestation longue qui déborderait de la fin de journée", () => {
    const t = times(run({ durationMin: 180 }));
    expect(t.at(-1)).toBe("16:00");
    expect(t).not.toContain("17:00");
  });

  it("aligne sur la grille une plage qui ne commence pas sur un quart d'heure", () => {
    const odd: StylistSchedule = {
      stylistId: "x",
      hours: [{ weekday: 2, start: "09:10", end: "11:00" }],
      busy: [],
    };
    expect(times(run({ stylists: [odd] }))[0]).toBe("09:15");
  });

  it("ne propose rien les jours de fermeture hebdomadaire (dimanche, lundi)", () => {
    const d = run({ fromDate: "2026-12-06", toDate: "2026-12-07" });
    expect(d.map((x) => x.slots.length)).toEqual([0, 0]);
  });

  it("retire les rendez-vous et absences, y compris les chevauchements partiels", () => {
    const busy = [{ start: at("2026-12-01T10:00"), end: at("2026-12-01T11:00") }];
    const t = times(run({ stylists: [{ ...ines, busy }] }));
    expect(t).not.toContain("09:15");
    expect(t).not.toContain("09:45"); // 09:45–10:45 chevauche
    expect(t).not.toContain("10:30");
    expect(t).toContain("11:00");
  });

  it("retire les fermetures du salon", () => {
    const closures = [{ start: at("2026-12-01T00:00"), end: at("2026-12-02T00:00") }];
    expect(run({ closures })[0]!.slots).toHaveLength(0);
  });

  it("respecte le délai minimal de 2 heures", () => {
    const now = new Date(at("2026-12-01T10:05"));
    expect(times(run({ now, durationMin: 30 }))[0]).toBe("12:15");
    // Une heure de prestation ne tient plus avant la pause : prochain créneau après le déjeuner.
    expect(times(run({ now }))[0]).toBe("14:00");
  });

  it("respecte l'horizon de 90 jours", () => {
    // 1er septembre + 90 jours = 30 novembre : le 1er décembre est hors horizon.
    expect(run({ now: new Date(at("2026-09-01T12:00")) })[0]!.slots.length).toBe(0);
    // 2 septembre 12 h + 90 × 24 h = 1er décembre 11 h (le passage à l'heure d'hiver décale d'une heure).
    const t = times(run({ now: new Date(at("2026-09-02T12:00")) }));
    expect(t.at(-1)).toBe("11:00");
  });

  it("« peu importe » : union des coiffeurs libres, avec la liste des coiffeurs par créneau", () => {
    const malik: StylistSchedule = { stylistId: "malik", hours: weekdays("09:30", "19:00"), busy: [] };
    const busyInes = { ...ines, busy: [{ start: at("2026-12-01T09:30"), end: at("2026-12-01T13:00") }] };
    const slots = run({ stylists: [busyInes, malik] })[0]!.slots;
    expect(slots.find((s) => s.start.includes("T10:00"))!.stylistIds).toEqual(["malik"]);
    expect(slots.find((s) => s.start.includes("T15:00"))!.stylistIds).toEqual(["ines", "malik"]);
  });

  it("renvoie les heures avec le décalage de Paris (hiver +01:00)", () => {
    expect(run()[0]!.slots[0]!.start).toBe("2026-12-01T09:30:00+01:00");
  });

  describe("changements d'heure (AC-04)", () => {
    const sunday: StylistSchedule = {
      stylistId: "dim",
      hours: [{ weekday: 7, start: "01:00", end: "05:00" }],
      busy: [],
    };

    it("passage à l'heure d'été (29 mars 2026) : 02:00–03:00 n'existe pas, aucun doublon", () => {
      const d = computeAvailability({
        fromDate: "2026-03-29",
        toDate: "2026-03-29",
        durationMin: 15,
        stylists: [sunday],
        closures: [],
        now: new Date(at("2026-03-20T00:00")),
      });
      const starts = d[0]!.slots.map((s) => s.start);
      expect(starts[0]).toBe("2026-03-29T01:00:00+01:00");
      expect(starts.some((s) => s.startsWith("2026-03-29T02:"))).toBe(false);
      expect(starts).toContain("2026-03-29T03:00:00+02:00");
      expect(new Set(starts).size).toBe(starts.length);
      // 01:00 → 05:00 locales = 3 h réelles ce jour-là = 12 quarts d'heure
      expect(starts).toHaveLength(12);
    });

    it("passage à l'heure d'hiver (25 octobre 2026) : 02:00–03:00 existe deux fois", () => {
      const d = computeAvailability({
        fromDate: "2026-10-25",
        toDate: "2026-10-25",
        durationMin: 15,
        stylists: [sunday],
        closures: [],
        now: new Date(at("2026-10-20T00:00")),
      });
      const starts = d[0]!.slots.map((s) => s.start);
      expect(starts).toContain("2026-10-25T02:00:00+02:00");
      expect(starts).toContain("2026-10-25T02:00:00+01:00");
      // 01:00 → 05:00 locales = 5 h réelles = 20 quarts d'heure
      expect(starts).toHaveLength(20);
    });

    it("une journée normale juste après le changement garde les bons horaires locaux", () => {
      const d = run({ fromDate: "2026-03-31", toDate: "2026-03-31", now: new Date(at("2026-03-28T00:00")) });
      expect(d[0]!.slots[0]!.start).toBe("2026-03-31T09:30:00+02:00");
    });
  });

  it("propriété : aucun créneau ne chevauche un rendez-vous et tous sont dans les horaires", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 200; i++) {
      const busy = Array.from({ length: 4 }, () => {
        const s = at("2026-12-01T09:00") + Math.floor(rnd() * 40) * 15 * 60_000;
        return { start: s, end: s + (1 + Math.floor(rnd() * 8)) * 15 * 60_000 };
      });
      const duration = [20, 30, 45, 60, 90, 180][Math.floor(rnd() * 6)]!;
      const slots = run({ durationMin: duration, stylists: [{ ...ines, busy }] })[0]!.slots;
      for (const s of slots) {
        const start = new Date(s.start).getTime();
        const end = start + duration * 60_000;
        expect(busy.some((b) => start < b.end && b.start < end)).toBe(false);
        const local = DateTime.fromMillis(start, { zone: Z });
        const endLocal = DateTime.fromMillis(end, { zone: Z });
        const inMorning = local.toFormat("HH:mm") >= "09:30" && endLocal.toFormat("HH:mm") <= "13:00";
        const inAfternoon = local.toFormat("HH:mm") >= "14:00" && endLocal.toFormat("HH:mm") <= "19:00";
        expect(inMorning || inAfternoon).toBe(true);
      }
      expect(new Set(slots.map((s) => s.start)).size).toBe(slots.length);
    }
  });
});
