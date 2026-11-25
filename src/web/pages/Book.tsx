import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import "react-day-picker/style.css";
import {
  api,
  ApiError,
  PRIVACY_NOTICE_VERSION,
  type Availability,
  type BookingResult,
  type Service,
  type Stylist,
} from "../api";
import { CATEGORY_LABEL, duration, longDate, price, time, ymd } from "../format";

const HORIZON_DAYS = 90;

export default function Book() {
  const [params] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [serviceId, setServiceId] = useState(params.get("service") ?? "");
  const [stylistId, setStylistId] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [avail, setAvail] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState<Date | undefined>();
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => new Date(), []);
  const lastDay = useMemo(() => new Date(today.getTime() + HORIZON_DAYS * 86_400_000), [today]);

  useEffect(() => {
    Promise.all([api<Service[]>("/services"), api<Stylist[]>("/stylists")])
      .then(([s, t]) => {
        setServices(s);
        setStylists(t);
      })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const service = services.find((s) => s.id === serviceId);
  const eligible = stylists.filter((s) => s.serviceIds.includes(serviceId));

  const loadAvailability = useCallback(async () => {
    if (!serviceId) return;
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const from = first < today ? today : first;
    const to = last > lastDay ? lastDay : last;
    if (from > to) return setAvail({ timezone: "Europe/Paris", durationMin: 0, days: [] });
    setLoading(true);
    try {
      const q = new URLSearchParams({ serviceId, from: ymd(from), to: ymd(to) });
      if (stylistId) q.set("stylistId", stylistId);
      setAvail(await api<Availability>(`/availability?${q}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serviceId, stylistId, month, today, lastDay]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const slotsByDay = useMemo(() => new Map((avail?.days ?? []).map((d) => [d.date, d.slots])), [avail]);
  const daySlots = day ? (slotsByDay.get(ymd(day)) ?? []) : [];

  function reset(part: "service" | "stylist" | "day") {
    if (part !== "day") setDay(undefined);
    setSlot(null);
    setError("");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return setError("Choisissez un jour et une heure disponibles.");
    const f = new FormData(e.currentTarget);
    setSubmitting(true);
    setError("");
    try {
      const r = await api<BookingResult>("/bookings", {
        method: "POST",
        json: {
          serviceId,
          stylistId: stylistId || null,
          start: slot,
          customer: { name: f.get("name"), email: f.get("email"), phone: f.get("phone") || undefined },
          note: (f.get("note") as string) || undefined,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          website: f.get("website") || undefined,
        },
      });
      setResult(r);
      setTimeout(() => resultRef.current?.focus(), 0);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.code === "slot_taken") {
        setSlot(null);
        void loadAvailability();
      }
      setError(
        ae.code === "validation_error"
          ? "Vérifiez votre nom (2 caractères minimum), votre e-mail et votre téléphone."
          : ae.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="book">
        <div className="wrap">
          <div className="ok" role="status" tabIndex={-1} ref={resultRef}>
            <h2>Rendez-vous confirmé</h2>
            <p>
              <b>{result.service.name}</b> avec {result.stylist.name}, le{" "}
              <b>
                {longDate(result.startsAt)} à {time(result.startsAt)}
              </b>
              .
              <br />
              Durée {duration(result.service.durationMin)} · {price(result.service.priceCents)}, à régler au
              salon.
            </p>
            <p>
              Un e-mail de confirmation vient de partir, avec un lien pour consulter ou annuler (jusqu’à 24 h
              avant). Un rappel vous sera envoyé la veille.
            </p>
            <p>
              <a className="btn" href={result.manageUrl}>
                Gérer ce rendez-vous
              </a>{" "}
              <Link className="btn ghost" to="/">
                Retour à l’accueil
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="book">
      <div className="wrap">
        <h1 className="h2">Réserver en ligne</h1>
        <p className="lead">
          Choisissez une prestation, un jour, une heure. Vous recevez la confirmation tout de suite.
        </p>
        <form onSubmit={submit} noValidate>
          <div className="grid2">
            <div>
              <label htmlFor="svc">1. Prestation</label>
              <select
                id="svc"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setStylistId("");
                  reset("service");
                }}
              >
                <option value="">Choisir une prestation…</option>
                {(Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).map((c) => (
                  <optgroup key={c} label={CATEGORY_LABEL[c]}>
                    {services
                      .filter((s) => s.category === c)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} – {duration(s.durationMin)} – {price(s.priceCents)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sty">2. Coiffeur</label>
              <select
                id="sty"
                value={stylistId}
                disabled={!serviceId}
                onChange={(e) => {
                  setStylistId(e.target.value);
                  reset("stylist");
                }}
              >
                <option value="">Peu importe</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} – {s.specialty}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {service && (
            <>
              <p className="lab" id="daylab">
                3. Jour {loading && <span className="small">(chargement…)</span>}
              </p>
              <div className="cal" aria-labelledby="daylab">
                <DayPicker
                  mode="single"
                  locale={fr}
                  weekStartsOn={1}
                  selected={day}
                  onSelect={(d) => {
                    setDay(d);
                    reset("day");
                  }}
                  month={month}
                  onMonthChange={setMonth}
                  startMonth={today}
                  endMonth={lastDay}
                  disabled={(d) => !slotsByDay.get(ymd(d))?.length}
                />
              </div>

              <p className="lab" id="slotlab">
                4. Heure
              </p>
              {!day ? (
                <p className="small">Choisissez d’abord un jour disponible.</p>
              ) : (
                <div className="slots" role="group" aria-labelledby="slotlab">
                  {daySlots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      aria-pressed={slot === s.start}
                      onClick={() => {
                        setSlot(s.start);
                        setError("");
                      }}
                    >
                      {time(s.start)}
                    </button>
                  ))}
                </div>
              )}

              <p className="lab">5. Vos coordonnées</p>
              <div className="grid2">
                <div>
                  <label htmlFor="nom">Nom et prénom</label>
                  <input id="nom" name="name" autoComplete="name" required minLength={2} maxLength={100} />
                </div>
                <div>
                  <label htmlFor="mail">E-mail (pour la confirmation)</label>
                  <input id="mail" name="email" type="email" autoComplete="email" required maxLength={254} />
                </div>
                <div>
                  <label htmlFor="tel">Téléphone (facultatif)</label>
                  <input id="tel" name="phone" type="tel" autoComplete="tel" maxLength={20} />
                </div>
                <div>
                  <label htmlFor="note">Précision (facultatif)</label>
                  <input
                    id="note"
                    name="note"
                    maxLength={500}
                    placeholder="Cheveux très longs, première couleur…"
                  />
                </div>
              </div>
              <div className="hp" aria-hidden="true">
                <label htmlFor="web">Ne pas remplir</label>
                <input id="web" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <p className="small notice">
                Vos coordonnées servent uniquement à gérer ce rendez-vous (confirmation, rappel, annulation).
                Elles sont anonymisées 12 mois après le rendez-vous.{" "}
                <Link to="/confidentialite">Politique de confidentialité</Link>.
              </p>
              <p className="err" role="alert">
                {error}
              </p>
              <button className="btn" type="submit" disabled={submitting || !slot}>
                {submitting
                  ? "Confirmation…"
                  : slot
                    ? `Confirmer : ${longDate(slot)} à ${time(slot)}`
                    : "Confirmer le rendez-vous"}
              </button>
            </>
          )}
          {!service && error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
