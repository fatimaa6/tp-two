import type { Config } from "@netlify/functions";
import { handle } from "../../src/server/http/router";
import { getDeps } from "../../src/server/runtime";

export default async (req: Request) => handle(req, getDeps());

export const config: Config = { path: "/api/*" };
