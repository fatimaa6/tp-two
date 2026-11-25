import pg from "pg";
import { migrate } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");
const pool = new pg.Pool({ connectionString: url, max: 1 });
const applied = await migrate(pool);
console.info(applied.length ? `Migrations appliquées : ${applied.join(", ")}` : "Base à jour.");
await pool.end();
