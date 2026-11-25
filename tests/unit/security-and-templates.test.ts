import { describe, expect, it } from "vitest";
import { hashPassword, randomToken, safeEqual, sha256, verifyPassword } from "../../src/server/security";
import { confirmationEmail, escapeHtml, manageUrl } from "../../src/server/email/templates";
import { maskEmail } from "../../src/server/log";

describe("mots de passe", () => {
  it("hache puis vérifie", async () => {
    const h = await hashPassword("un-mot-de-passe-solide");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("un-mot-de-passe-solide", h)).toBe(true);
    expect(await verifyPassword("mauvais-mot-de-passe", h)).toBe(false);
  });
  it("refuse moins de 12 caractères", async () => {
    await expect(hashPassword("court")).rejects.toThrow();
  });
  it("refuse un hash malformé", async () => expect(await verifyPassword("x", "md5$abc")).toBe(false));
});

describe("jetons", () => {
  it("jeton de 256 bits encodé en base64url (43 caractères)", () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(t);
    expect(sha256(t)).toHaveLength(64);
  });
  it("comparaison à temps constant", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("e-mails", () => {
  const data = {
    customerName: "<script>alert(1)</script>",
    serviceName: "Coupe homme",
    stylistName: "Malik",
    startsAt: new Date("2026-12-01T08:30:00Z"),
    priceCents: 3500,
    durationMin: 30,
  };
  it("affiche l'heure de Paris et échappe le HTML", () => {
    const m = confirmationEmail("a@example.com", data, manageUrl("https://x.example", "TOKEN"));
    expect(m.text).toContain("9h30");
    expect(m.text).toContain("mardi 1 décembre 2026");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
  it("met le jeton dans le fragment de l'URL", () => {
    expect(manageUrl("https://x.example", "abc")).toBe("https://x.example/gerer#t=abc");
  });
  it("échappe les caractères spéciaux", () =>
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;"));
  it("masque les e-mails dans les journaux", () =>
    expect(maskEmail("zeynab@example.com")).toBe("z***@example.com"));
});
