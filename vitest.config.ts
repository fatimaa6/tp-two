import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Les tests d'intégration partagent une base : pas d'exécution parallèle entre fichiers.
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts"],
      thresholds: {
        "src/server/domain/**": { lines: 90 },
      },
    },
  },
});
