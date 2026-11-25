import type { Config } from "@netlify/functions";
import { getDeps } from "../../src/server/runtime";
import { purgeOldData } from "../../src/server/services/jobs";

/** Fonction planifiée Netlify : chaque nuit à 02 h 17 UTC (anonymisation et purge). */
export default async () => {
  await purgeOldData(getDeps());
};

export const config: Config = { schedule: "17 2 * * *" };
