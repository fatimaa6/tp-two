/** Journalisation JSON sans données personnelles. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown> = {},
) {
  // eslint-disable-next-line no-console -- niveau dynamique (info, warn, error uniquement)
  console[level](JSON.stringify({ level, event, time: new Date().toISOString(), ...data }));
}
