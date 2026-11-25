const TZ = "Europe/Paris";

export const price = (cents: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export const time = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
    .format(new Date(iso))
    .replace(":", " h ");

export const longDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

/** Date calendaire locale (navigateur) au format YYYY-MM-DD. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const CATEGORY_LABEL = { women: "Femme", men: "Homme", children: "Enfant" } as const;
