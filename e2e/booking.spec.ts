import { expect, test } from "@playwright/test";

test("un client réserve, reçoit un lien privé et annule (FR-05 à FR-09)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Une coupe qui vous ressemble");
  await page.getByRole("tab", { name: "Homme" }).click();
  await page.getByRole("link", { name: "Réserver : Coupe homme" }).click();

  await expect(page).toHaveURL(/\/reserver\?service=/);
  await expect(page.getByLabel("1. Prestation")).toHaveValue(/[0-9a-f-]{36}/);
  // Prochain jour disponible (le calendrier n'active que les jours avec créneaux).
  // Troisième jour disponible : toujours à plus de 24 h, donc annulable en ligne.
  const day = page.locator(".rdp-day:not(.rdp-disabled) button").nth(2);
  await expect(day).toBeVisible();
  await day.click();
  await page.locator(".slots button").first().click();
  await page.getByLabel("Nom et prénom").fill("Client E2E");
  await page.getByLabel("E-mail (pour la confirmation)").fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /^Confirmer/ }).click();

  await expect(page.getByRole("heading", { name: "Rendez-vous confirmé" })).toBeVisible();
  await page.getByRole("link", { name: "Gérer ce rendez-vous" }).click();
  await expect(page).toHaveURL(/\/gerer$/); // le jeton est retiré de la barre d'adresse
  await expect(page.getByText("Confirmé")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Annuler ce rendez-vous" }).click();
  await expect(page.getByText("Annulé par vous")).toBeVisible();
});
