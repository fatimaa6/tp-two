import { defineConfig, devices } from "@playwright/test";

/** Les tests E2E tournent contre le serveur local (dist/ + routeur API) sur une base PostgreSQL de test. */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8888",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] }, testMatch: /booking/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run serve:local",
        url: "http://localhost:8888/api/healthz",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
