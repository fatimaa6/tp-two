import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/reserver", "/confidentialite", "/mentions-legales", "/admin"]) {
  test(`accessibilité : aucune violation critique ou sérieuse sur ${path} (AC-10)`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("l'espace salon refuse un mauvais mot de passe", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("E-mail").fill("admin@example.com");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
});
