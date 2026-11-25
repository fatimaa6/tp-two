import type { Config } from "@netlify/functions";
import { getDeps } from "../../src/server/runtime";
import { sendReminders } from "../../src/server/services/jobs";

/** Fonction planifiée Netlify : toutes les heures. Non exposée publiquement. */
export default async () => {
  await sendReminders(getDeps());
};

export const config: Config = { schedule: "@hourly" };
