import nodemailer from "nodemailer";
import type { AppConfig } from "../config";
import { maskEmail } from "../log";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Interface d'envoi : le fournisseur (Gmail SMTP aujourd'hui) reste remplaçable. */
export interface Mailer {
  send(msg: EmailMessage): Promise<"sent" | "logged">;
}

export class SmtpMailer implements Mailer {
  private transport;
  constructor(private cfg: AppConfig) {
    this.transport = nodemailer.createTransport({
      host: cfg.smtp.host,
      port: cfg.smtp.port,
      secure: cfg.smtp.port === 465,
      auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    });
  }
  async send(msg: EmailMessage): Promise<"sent"> {
    await this.transport.sendMail({ from: this.cfg.mailFrom, ...msg });
    return "sent";
  }
}

/** Aucun envoi : journalise le sujet et le destinataire masqué. Utile sans compte SMTP. */
export class LogMailer implements Mailer {
  async send(msg: EmailMessage): Promise<"logged"> {
    console.info(
      JSON.stringify({ level: "info", event: "email.logged", to: maskEmail(msg.to), subject: msg.subject }),
    );
    return "logged";
  }
}

/** Pour les tests : garde les messages en mémoire. */
export class MemoryMailer implements Mailer {
  sent: EmailMessage[] = [];
  failNext = false;
  async send(msg: EmailMessage): Promise<"sent"> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("SMTP indisponible (simulation)");
    }
    this.sent.push(msg);
    return "sent";
  }
}
