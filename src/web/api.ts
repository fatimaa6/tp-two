/** Client de l'API (même origine : /api). */
export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "women" | "men" | "children";
  durationMin: number;
  priceCents: number;
}
export interface Stylist {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  bio: string;
  serviceIds: string[];
}
export interface Slot {
  start: string;
  stylistIds: string[];
}
export interface Availability {
  timezone: string;
  durationMin: number;
  days: { date: string; slots: Slot[] }[];
}
export interface BookingResult {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string; priceCents: number; durationMin: number };
  stylist: { id: string; name: string };
  manageUrl: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      credentials: "same-origin",
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "network", "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? "error",
      body?.error?.message ?? "Une erreur est survenue.",
    );
  }
  return body as T;
}

export const PRIVACY_NOTICE_VERSION = "2026-11-25";
