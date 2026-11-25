import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function errorResponse(e: HttpError, requestId: string): Response {
  return json(
    e.status,
    { error: { code: e.code, message: e.message, details: e.details } },
    { "x-request-id": requestId },
  );
}

/** Lit un corps JSON et le valide. Refuse tout autre type de contenu (défense CSRF). */
export async function readJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Le corps doit être du JSON.");
  }
  const raw = await req.text();
  if (raw.length > 10_000) throw new HttpError(413, "payload_too_large", "Requête trop volumineuse.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "JSON invalide.");
  }
  return parse(schema, data);
}

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(422, "validation_error", "Certaines informations sont invalides.", {
      fields: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return r.data;
}

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
