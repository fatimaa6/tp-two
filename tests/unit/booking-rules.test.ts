import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { canClientCancel, checkStart, orderByLoad } from "../../src/server/domain/booking";

const p = (iso: string) => DateTime.fromISO(iso, { zone: "Europe/Paris" }).toJSDate();
const now = p("2026-12-01T10:00");

describe("checkStart (BR-04, BR-05)", () => {
  it("accepte un quart d'heure dans la fenêtre", () =>
    expect(checkStart(p("2026-12-01T12:00"), now)).toEqual({ ok: true }));
  it("refuse hors grille", () =>
    expect(checkStart(p("2026-12-01T12:10"), now)).toMatchObject({ code: "not_on_grid" }));
  it("refuse à moins de 2 h", () =>
    expect(checkStart(p("2026-12-01T11:45"), now)).toMatchObject({ code: "too_soon" }));
  it("accepte à exactement 2 h", () => expect(checkStart(p("2026-12-01T12:00"), now).ok).toBe(true));
  it("refuse au-delà de 90 jours", () =>
    expect(checkStart(p("2027-03-02T10:15"), now)).toMatchObject({ code: "too_far" }));
});

describe("canClientCancel (BR-06)", () => {
  const start = p("2026-12-03T10:00");
  it("autorise à 24 h 01", () => expect(canClientCancel(start, p("2026-12-02T09:59"))).toBe(true));
  it("autorise à exactement 24 h", () => expect(canClientCancel(start, p("2026-12-02T10:00"))).toBe(true));
  it("refuse à 23 h 59", () => expect(canClientCancel(start, p("2026-12-02T10:01"))).toBe(false));
});

describe("orderByLoad (BR-03)", () => {
  it("choisit le moins chargé, puis l'ordre d'affichage", () => {
    expect(
      orderByLoad([
        { stylistId: "a", bookingsThatDay: 3, sortOrder: 0 },
        { stylistId: "b", bookingsThatDay: 1, sortOrder: 2 },
        { stylistId: "c", bookingsThatDay: 1, sortOrder: 1 },
      ]),
    ).toEqual(["c", "b", "a"]);
  });
});
