import pg from "pg";
import { seed } from "../src/server/db/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");
if (process.env.APP_ENV === "production" && process.env.ALLOW_SEED_PRODUCTION !== "yes") {
  throw new Error(
    "Refus : seed en production. Définir ALLOW_SEED_PRODUCTION=yes pour le premier chargement du catalogue.",
  );
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
await seed(pool);
console.info("Catalogue fictif chargé (prestations, coiffeurs, horaires).");
await pool.end();
