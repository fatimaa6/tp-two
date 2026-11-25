import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Service, type Stylist } from "../api";
import { AVATARS, GALLERY, Head, SalonMap } from "../components/Illustration";
import { CATEGORY_LABEL, duration, price } from "../format";

type Cat = keyof typeof CATEGORY_LABEL;

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [cat, setCat] = useState<Cat>("women");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    Promise.all([api<Service[]>("/services"), api<Stylist[]>("/stylists")])
      .then(([s, t]) => {
        setServices(s);
        setStylists(t);
      })
      .catch((e: ApiError) => setLoadError(e.message));
  }, []);

  const cats = Object.keys(CATEGORY_LABEL) as Cat[];
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Une coupe qui vous ressemble, sans effort.</h1>
            <p className="lead">
              Studio Sillage est un salon indépendant au cœur de Paris 1<sup>er</sup>. Trois coiffeurs, du
              temps pour écouter, des gestes précis. Femmes, hommes et enfants sont les bienvenus.
            </p>
            <div className="actions">
              <Link className="btn" to="/reserver">
                Réserver un créneau
              </Link>
              <a className="btn ghost" href="#tarifs">
                Voir les tarifs
              </a>
            </div>
          </div>
          <div className="mirror" aria-hidden="true">
            <div className="slot">
              <small>Réservation en ligne</small>
              <b>24 h/24, 7 j/7</b>
              <small>Confirmation immédiate par e-mail</small>
            </div>
          </div>
        </div>
      </section>

      <section id="tarifs">
        <div className="wrap">
          <h2>Prestations et tarifs</h2>
          <p className="lead">
            Les prix incluent le shampoing et le coiffage. Paiement au salon : carte, espèces et chèques
            vacances.
          </p>
          <div className="tabs" role="tablist" aria-label="Catégories">
            {cats.map((c) => (
              <button
                key={c}
                id={`tab-${c}`}
                className="tab"
                role="tab"
                aria-selected={cat === c}
                aria-controls="prices"
                tabIndex={cat === c ? 0 : -1}
                onClick={() => setCat(c)}
                onKeyDown={(e) => {
                  const i = cats.indexOf(cat);
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    const next = cats[(i + (e.key === "ArrowRight" ? 1 : cats.length - 1)) % cats.length]!;
                    setCat(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }
                }}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          {loadError && (
            <p className="err" role="alert">
              {loadError}
            </p>
          )}
          <div id="prices" role="tabpanel" aria-labelledby={`tab-${cat}`}>
            <ul className="prices">
              {services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <li key={s.id}>
                    <span>
                      {s.name}
                      <span className="t block">{s.description}</span>
                    </span>
                    <span className="t">{duration(s.durationMin)}</span>
                    <span className="p">{price(s.priceCents)}</span>
                    <Link
                      className="btn sm ghost"
                      to={`/reserver?service=${s.id}`}
                      aria-label={`Réserver : ${s.name}`}
                    >
                      Choisir
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="equipe">
        <div className="wrap">
          <h2>Votre équipe</h2>
          <p className="lead">Chacun a sa spécialité. Choisissez-la, ou laissez-nous vous orienter.</p>
          <div className="team">
            {stylists.map((s) => (
              <article key={s.id}>
                <div className="av">{AVATARS[s.slug] && <Head {...AVATARS[s.slug]!} />}</div>
                <h3>{s.name}</h3>
                <p className="spec">{s.specialty}</p>
                <p>{s.bio}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="realisations">
        <div className="wrap">
          <h2>Nos réalisations</h2>
          <p className="lead">Quelques couleurs et coupes du moment, en illustration.</p>
          <div className="gal">
            {GALLERY.map((g) => (
              <figure key={g.label} style={{ background: `linear-gradient(160deg, ${g.from}, ${g.to})` }}>
                <Head hair={g.hair} skin={g.skin} cut={g.cut} />
                <figcaption>{g.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="infos">
        <div className="wrap info">
          <div>
            <h2>Nous trouver</h2>
            <dl>
              <dt>Adresse</dt>
              <dd>
                12 rue des Petits-Champs, 75001 Paris
                <br />
                Métro Pyramides (lignes 7 et 14)
              </dd>
              <dt>Téléphone</dt>
              <dd>01 23 45 67 89</dd>
            </dl>
          </div>
          <div>
            <h2>Horaires</h2>
            <dl>
              <dt>Mardi au vendredi</dt>
              <dd>9 h 30 – 13 h 00 et 14 h 00 – 19 h 00</dd>
              <dt>Samedi</dt>
              <dd>9 h 00 – 18 h 00</dd>
              <dt>Dimanche et lundi</dt>
              <dd>Fermé</dd>
            </dl>
          </div>
          <div>
            <h2>Questions fréquentes</h2>
            <details>
              <summary>Puis-je annuler ?</summary>
              <p>
                Oui, gratuitement jusqu’à 24 heures avant, avec le lien reçu par e-mail. Ensuite, appelez le
                salon.
              </p>
            </details>
            <details>
              <summary>Quels moyens de paiement ?</summary>
              <p>Carte, espèces et chèques vacances, au salon. Pas de paiement en ligne.</p>
            </details>
            <details>
              <summary>Combien dure une couleur ?</summary>
              <p>
                Comptez 1 h 30 pour les racines et 3 h pour un balayage. La durée est indiquée dans les
                tarifs.
              </p>
            </details>
            <details>
              <summary>Le salon est-il accessible ?</summary>
              <p>Oui, l’entrée est de plain-pied et un bac à shampoing est adapté aux fauteuils roulants.</p>
            </details>
          </div>
        </div>
      </section>

      <section id="contact">
        <div className="wrap">
          <h2>Contact</h2>
          <p className="lead">Une question, une demande particulière ? Écrivez-nous ou passez au salon.</p>
          <div className="cgrid">
            <ContactForm />
            <div>
              <SalonMap />
              <p>
                <b>Studio Sillage</b>
                <br />
                12 rue des Petits-Champs, 75001 Paris
                <br />
                Métro Pyramides (lignes 7 et 14)
              </p>
              <a
                className="btn ghost sm"
                href="https://www.openstreetmap.org/search?query=12%20rue%20des%20Petits-Champs%2075001%20Paris"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir dans OpenStreetMap
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setState("sending");
    try {
      await api("/contact", {
        method: "POST",
        json: {
          name: f.get("name"),
          email: f.get("email"),
          message: f.get("message"),
          website: f.get("website"),
        },
      });
      setState("done");
    } catch (err) {
      setState("idle");
      setError(
        err instanceof ApiError && err.code === "validation_error"
          ? "Vérifiez votre nom, votre e-mail et votre message (5 caractères minimum)."
          : (err as Error).message,
      );
    }
  }
  if (state === "done")
    return (
      <div className="ok" role="status">
        <h3>Message envoyé</h3>
        <p>Merci, nous vous répondons sous 24 heures.</p>
      </div>
    );
  return (
    <form onSubmit={submit}>
      <label htmlFor="cn">Nom</label>
      <input id="cn" name="name" autoComplete="name" required minLength={2} maxLength={100} />
      <label htmlFor="ce">E-mail</label>
      <input id="ce" name="email" type="email" autoComplete="email" required maxLength={254} />
      <label htmlFor="cm">Message</label>
      <textarea id="cm" name="message" rows={5} required minLength={5} maxLength={2000} />
      <div className="hp" aria-hidden="true">
        <label htmlFor="cw">Ne pas remplir</label>
        <input id="cw" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="err" role="alert">
        {error}
      </p>
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Envoi…" : "Envoyer le message"}
      </button>
      <p className="small">
        Vos données servent uniquement à vous répondre et sont supprimées après 90 jours.{" "}
        <Link to="/confidentialite">En savoir plus</Link>.
      </p>
    </form>
  );
}
