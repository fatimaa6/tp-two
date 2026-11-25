import { DateTime } from "luxon";
import { SALON_TZ } from "../domain/rules";
import type { EmailMessage } from "./mailer";

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function formatWhen(d: Date): string {
  return DateTime.fromJSDate(d, { zone: SALON_TZ }).setLocale("fr").toFormat("cccc d LLLL yyyy 'à' H'h'mm");
}

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const SALON = "Studio Sillage – 12 rue des Petits-Champs, 75001 Paris – 01 23 45 67 89";

function wrap(title: string, paragraphs: string[], link?: { href: string; label: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  const button = link
    ? `<p style="margin:20px 0"><a href="${escapeHtml(link.href)}" style="background:#B43E8F;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${escapeHtml(link.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#2B1F33;background:#FFFBFD;padding:24px">
<h1 style="font-family:Georgia,serif;font-weight:400;color:#B43E8F">${escapeHtml(title)}</h1>${body}${button}
<p style="color:#6B5B73;font-size:13px">${escapeHtml(SALON)}<br>Projet de démonstration : salon fictif.</p></body></html>`;
}

export interface BookingMailData {
  customerName: string;
  serviceName: string;
  stylistName: string;
  startsAt: Date;
  priceCents: number;
  durationMin: number;
}

export function manageUrl(baseUrl: string, token: string): string {
  // Le jeton voyage dans le fragment (#) : il n'est jamais envoyé au serveur ni dans le Referer.
  return `${baseUrl}/gerer#t=${token}`;
}

export function confirmationEmail(to: string, b: BookingMailData, link: string): EmailMessage {
  const when = formatWhen(b.startsAt);
  const lines = [
    `Bonjour ${b.customerName},`,
    `Votre rendez-vous est confirmé : ${b.serviceName} avec ${b.stylistName}, le ${when} (durée ${b.durationMin} min, ${formatPrice(b.priceCents)}, à régler au salon).`,
    "Vous pouvez consulter ou annuler gratuitement ce rendez-vous jusqu'à 24 heures avant. Passé ce délai, appelez le salon.",
  ];
  return {
    to,
    subject: `Rendez-vous confirmé – ${when}`,
    text: `${lines.join("\n\n")}\n\nGérer mon rendez-vous : ${link}\n\n${SALON}`,
    html: wrap("Rendez-vous confirmé", lines.map(escapeHtml), { href: link, label: "Gérer mon rendez-vous" }),
  };
}

export function reminderEmail(to: string, b: BookingMailData, link: string): EmailMessage {
  const when = formatWhen(b.startsAt);
  const lines = [
    `Bonjour ${b.customerName},`,
    `Petit rappel : ${b.serviceName} avec ${b.stylistName}, demain, le ${when}.`,
    "Un empêchement ? Appelez le salon au 01 23 45 67 89.",
  ];
  return {
    to,
    subject: `Rappel : votre rendez-vous du ${when}`,
    text: `${lines.join("\n\n")}\n\nVoir mon rendez-vous : ${link}\n\n${SALON}`,
    html: wrap("À demain !", lines.map(escapeHtml), { href: link, label: "Voir mon rendez-vous" }),
  };
}

export function cancellationEmail(to: string, b: BookingMailData, bySalon: boolean): EmailMessage {
  const when = formatWhen(b.startsAt);
  const lines = [
    `Bonjour ${b.customerName},`,
    bySalon
      ? `Le salon a dû annuler votre rendez-vous (${b.serviceName}, le ${when}). Nous sommes désolés : appelez-nous pour choisir un autre créneau.`
      : `Votre rendez-vous (${b.serviceName}, le ${when}) est bien annulé.`,
  ];
  return {
    to,
    subject: `Rendez-vous annulé – ${when}`,
    text: `${lines.join("\n\n")}\n\n${SALON}`,
    html: wrap("Rendez-vous annulé", lines.map(escapeHtml)),
  };
}

export function salonCancellationNotice(to: string, b: BookingMailData): EmailMessage {
  const when = formatWhen(b.startsAt);
  const text = `Annulation par le client : ${b.serviceName} avec ${b.stylistName}, le ${when}. Le créneau est de nouveau disponible.`;
  return {
    to,
    subject: `Annulation client – ${when}`,
    text,
    html: wrap("Annulation client", [escapeHtml(text)]),
  };
}

export function contactEmail(to: string, m: { name: string; email: string; message: string }): EmailMessage {
  return {
    to,
    subject: `Message du site – ${m.name.slice(0, 60)}`,
    text: `De : ${m.name} <${m.email}>\n\n${m.message}`,
    html: wrap("Nouveau message du site", [
      `De : ${escapeHtml(m.name)} &lt;${escapeHtml(m.email)}&gt;`,
      escapeHtml(m.message).replace(/\n/g, "<br>"),
    ]),
  };
}
