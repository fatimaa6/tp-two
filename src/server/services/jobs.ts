import type { Deps } from "../deps";
import { reminderEmail } from "../email/templates";
import { logEvent } from "../log";
import { sendLogged, toMailData } from "./bookings";

/**
 * Rappel J-1 (FR-08). Fenêtre de 20 h à 26 h avant le début : une exécution horaire en retard
 * ou manquée est rattrapée. Idempotent : chaque rendez-vous est « réservé » par un UPDATE atomique.
 * Le lien de gestion n'est pas renvoyé (seul son hash est stocké) : le rappel pointe vers la page d'accueil.
 */
export async function sendReminders(deps: Deps) {
  const now = deps.now();
  const { rows } = await deps.pool.query(
    `UPDATE bookings b SET reminder_sent_at = $1
     FROM stylists s
     WHERE s.id = b.stylist_id AND b.status='confirmed' AND b.reminder_sent_at IS NULL
       AND b.starts_at BETWEEN $2 AND $3
     RETURNING b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.customer_email,
               b.service_name, b.price_cents, b.duration_min, s.display_name AS stylist_name`,
    [now, new Date(now.getTime() + 20 * 3_600_000), new Date(now.getTime() + 26 * 3_600_000)],
  );
  let sent = 0;
  for (const b of rows) {
    const ok = await sendLogged(
      deps,
      b.id,
      "reminder",
      reminderEmail(b.customer_email, toMailData(b), `${deps.config.appBaseUrl}/`),
    );
    if (ok) sent++;
    else await deps.pool.query("UPDATE bookings SET reminder_sent_at = NULL WHERE id=$1", [b.id]); // réessai à la prochaine heure
  }
  logEvent("info", "job.reminders", { candidates: rows.length, sent });
  return { candidates: rows.length, sent };
}

/** Conservation (PRD section 7) : anonymisation à 12 mois, messages de contact supprimés à 90 jours. */
export async function purgeOldData(deps: Deps) {
  const now = deps.now();
  const yearAgo = new Date(now);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const anonymised = await deps.pool.query(
    `UPDATE bookings SET customer_name='Anonyme', customer_email='anonyme@invalid', customer_phone=NULL, note=NULL,
       anonymised_at=$1 WHERE ends_at < $2 AND anonymised_at IS NULL`,
    [now, yearAgo],
  );
  const contacts = await deps.pool.query("DELETE FROM contact_messages WHERE created_at < $1", [
    new Date(now.getTime() - 90 * 86_400_000),
  ]);
  await deps.pool.query("DELETE FROM admin_sessions WHERE expires_at < $1", [now]);
  await deps.pool.query("DELETE FROM rate_limit_events WHERE created_at < $1", [
    new Date(now.getTime() - 86_400_000),
  ]);
  const result = { anonymised: anonymised.rowCount ?? 0, contactsDeleted: contacts.rowCount ?? 0 };
  logEvent("info", "job.purge", result);
  return result;
}
