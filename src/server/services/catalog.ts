import type pg from "pg";

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "women" | "men" | "children";
  duration_min: number;
  price_cents: number;
}

export async function listServices(pool: pg.Pool) {
  const { rows } = await pool.query<ServiceRow>(
    `SELECT id, slug, name, description, category, duration_min, price_cents
     FROM services WHERE is_active ORDER BY sort_order, name`,
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    durationMin: r.duration_min,
    priceCents: r.price_cents,
  }));
}

export async function listStylists(pool: pg.Pool) {
  const { rows } = await pool.query<{
    id: string;
    slug: string;
    display_name: string;
    specialty: string;
    bio: string;
    service_ids: string[] | null;
  }>(
    `SELECT s.id, s.slug, s.display_name, s.specialty, s.bio,
            array_agg(ss.service_id) FILTER (WHERE ss.service_id IS NOT NULL) AS service_ids
     FROM stylists s LEFT JOIN stylist_services ss ON ss.stylist_id = s.id
     WHERE s.is_active GROUP BY s.id ORDER BY s.sort_order, s.display_name`,
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.display_name,
    specialty: r.specialty,
    bio: r.bio,
    serviceIds: r.service_ids ?? [],
  }));
}
