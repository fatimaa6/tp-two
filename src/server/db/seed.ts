import type pg from "pg";

/** Données fictives du salon de démonstration. Idempotent (upsert par slug). */
export const SEED_SERVICES = [
  {
    slug: "coupe-brushing",
    name: "Coupe et brushing",
    category: "women",
    duration: 60,
    price: 6500,
    description: "Shampoing, coupe et coiffage.",
  },
  {
    slug: "couleur-racines",
    name: "Couleur racines",
    category: "women",
    duration: 90,
    price: 7000,
    description: "Coloration des racines, shampoing et coiffage.",
  },
  {
    slug: "balayage",
    name: "Balayage",
    category: "women",
    duration: 180,
    price: 14000,
    description: "Éclaircissement naturel à main levée.",
  },
  {
    slug: "soin-profond",
    name: "Soin profond",
    category: "women",
    duration: 30,
    price: 3500,
    description: "Masque nourrissant et massage du cuir chevelu.",
  },
  {
    slug: "chignon",
    name: "Chignon",
    category: "women",
    duration: 60,
    price: 8000,
    description: "Coiffure d'événement.",
  },
  {
    slug: "coupe-homme",
    name: "Coupe homme",
    category: "men",
    duration: 30,
    price: 3500,
    description: "Coupe aux ciseaux ou à la tondeuse.",
  },
  {
    slug: "coupe-barbe",
    name: "Coupe et barbe",
    category: "men",
    duration: 45,
    price: 5000,
    description: "Coupe et taille de barbe au rasoir.",
  },
  {
    slug: "degrade",
    name: "Dégradé",
    category: "men",
    duration: 40,
    price: 4000,
    description: "Dégradé net, finitions au rasoir.",
  },
  {
    slug: "barbe",
    name: "Barbe",
    category: "men",
    duration: 20,
    price: 2000,
    description: "Taille et contours.",
  },
  {
    slug: "coupe-enfant",
    name: "Coupe enfant (– de 12 ans)",
    category: "children",
    duration: 30,
    price: 2200,
    description: "Coupe adaptée aux plus jeunes.",
  },
  {
    slug: "coupe-ado",
    name: "Coupe ado",
    category: "children",
    duration: 30,
    price: 2800,
    description: "De 12 à 17 ans.",
  },
] as const;

export const SEED_STYLISTS = [
  {
    slug: "ines",
    name: "Inès",
    specialty: "Couleur et balayages",
    bio: "Dix ans de colorimétrie, une obsession pour les blonds chauds et les reflets naturels.",
    services: ["coupe-brushing", "couleur-racines", "balayage", "soin-profond"],
  },
  {
    slug: "malik",
    name: "Malik",
    specialty: "Coupes homme, dégradés et barbes",
    bio: "Il travaille au rasoir et aux ciseaux, avec un rendu net qui tient trois semaines.",
    services: ["coupe-homme", "coupe-barbe", "degrade", "barbe", "coupe-enfant", "coupe-ado"],
  },
  {
    slug: "camille",
    name: "Camille",
    specialty: "Coupes femme, carrés et chignons",
    bio: "Elle adapte chaque coupe à votre texture de cheveux et à votre routine.",
    services: ["coupe-brushing", "chignon", "soin-profond", "coupe-enfant", "coupe-ado"],
  },
] as const;

/** Mardi–vendredi 9 h 30–13 h et 14 h–19 h ; samedi 9 h–18 h. Fermé dimanche et lundi. */
export const SEED_HOURS: { weekday: number; start: string; end: string }[] = [
  ...[2, 3, 4, 5].flatMap((d) => [
    { weekday: d, start: "09:30", end: "13:00" },
    { weekday: d, start: "14:00", end: "19:00" },
  ]),
  { weekday: 6, start: "09:00", end: "18:00" },
];

export async function seed(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [i, s] of SEED_SERVICES.entries()) {
      await client.query(
        `INSERT INTO services (slug, name, description, category, duration_min, price_cents, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET name=$2, description=$3, category=$4, duration_min=$5, price_cents=$6, sort_order=$7`,
        [s.slug, s.name, s.description, s.category, s.duration, s.price, i],
      );
    }
    for (const [i, st] of SEED_STYLISTS.entries()) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO stylists (slug, display_name, specialty, bio, sort_order) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO UPDATE SET display_name=$2, specialty=$3, bio=$4, sort_order=$5 RETURNING id`,
        [st.slug, st.name, st.specialty, st.bio, i],
      );
      const id = rows[0]!.id;
      await client.query("DELETE FROM stylist_services WHERE stylist_id=$1", [id]);
      await client.query(
        `INSERT INTO stylist_services (stylist_id, service_id) SELECT $1, id FROM services WHERE slug = ANY($2)`,
        [id, st.services],
      );
      await client.query("DELETE FROM working_hours WHERE stylist_id=$1", [id]);
      for (const h of SEED_HOURS) {
        await client.query(
          "INSERT INTO working_hours (stylist_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)",
          [id, h.weekday, h.start, h.end],
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
