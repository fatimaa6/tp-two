import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Stylist } from "../../api";
import { longDate, price, time, ymd } from "../../format";

interface AdminBooking {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  note: string | null;
  serviceName: string;
  priceCents: number;
  stylistName: string;
}
interface Period {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  stylistName?: string;
}

export default function Admin() {
  const [state, setState] = useState<"checking" | "out" | "in">("checking");
  useEffect(() => {
    api("/admin/me")
      .then(() => setState("in"))
      .catch(() => setState("out"));
  }, []);
  if (state === "checking")
    return (
      <section>
        <div className="wrap">
          <p>Chargement…</p>
        </div>
      </section>
    );
  if (state === "out") return <Login onDone={() => setState("in")} />;
  return <Dashboard onLogout={() => setState("out")} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/admin/session", {
        method: "POST",
        json: { email: f.get("email"), password: f.get("password") },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="wrap narrow">
        <h1 className="h2">Espace salon</h1>
        <form onSubmit={submit}>
          <label htmlFor="ae">E-mail</label>
          <input id="ae" name="email" type="email" autoComplete="username" required />
          <label htmlFor="ap">Mot de passe</label>
          <input id="ap" name="password" type="password" autoComplete="current-password" required />
          <p className="err" role="alert">
            {error}
          </p>
          <button className="btn" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </section>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"agenda" | "absences">("agenda");
  async function logout() {
    await api("/admin/session", { method: "DELETE" }).catch(() => undefined);
    onLogout();
  }
  return (
    <section>
      <div className="wrap">
        <div className="adminbar">
          <h1 className="h2">Espace salon</h1>
          <button className="btn ghost sm" onClick={logout}>
            Se déconnecter
          </button>
        </div>
        <div className="tabs" role="tablist" aria-label="Sections">
          <button
            className="tab"
            role="tab"
            aria-selected={tab === "agenda"}
            onClick={() => setTab("agenda")}
          >
            Agenda
          </button>
          <button
            className="tab"
            role="tab"
            aria-selected={tab === "absences"}
            onClick={() => setTab("absences")}
          >
            Absences et fermetures
          </button>
        </div>
        {tab === "agenda" ? <Agenda onAuthLost={onLogout} /> : <Absences onAuthLost={onLogout} />}
      </div>
    </section>
  );
}

const STATUS: Record<string, string> = {
  confirmed: "Confirmé",
  cancelled_by_client: "Annulé (client)",
  cancelled_by_salon: "Annulé (salon)",
  completed: "Terminé",
  no_show: "Absent",
};

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function Agenda({ onAuthLost }: { onAuthLost: () => void }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [rows, setRows] = useState<AdminBooking[]>([]);
  const [error, setError] = useState("");
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdminBooking[]>(`/admin/bookings?from=${ymd(weekStart)}&to=${ymd(weekEnd)}`));
      setError("");
    } catch (e) {
      if ((e as ApiError).status === 401) onAuthLost();
      setError((e as Error).message);
    }
    // weekEnd dérive de weekStart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, onAuthLost]);
  useEffect(() => {
    void load();
  }, [load]);

  async function cancel(b: AdminBooking) {
    if (!window.confirm(`Annuler le rendez-vous de ${b.customerName} ? Le client sera prévenu par e-mail.`))
      return;
    try {
      await api(`/admin/bookings/${b.id}/cancel`, { method: "POST" });
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const byDay = new Map<string, AdminBooking[]>();
  for (const r of rows) {
    const k = longDate(r.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const shift = (days: number) => setWeekStart(new Date(weekStart.getTime() + days * 86_400_000));

  return (
    <div>
      <div className="weeknav">
        <button className="tab" onClick={() => shift(-7)} aria-label="Semaine précédente">
          ‹
        </button>
        <b>Semaine du {weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</b>
        <button className="tab" onClick={() => shift(7)} aria-label="Semaine suivante">
          ›
        </button>
        <button className="tab" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          Aujourd’hui
        </button>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {rows.length === 0 && <p>Aucun rendez-vous cette semaine.</p>}
      {[...byDay.entries()].map(([dayLabel, list]) => (
        <div key={dayLabel} className="agenda-day">
          <h2 className="h3">{dayLabel}</h2>
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>Coiffeur</th>
                <th>Prestation</th>
                <th>Client</th>
                <th>Statut</th>
                <th>
                  <span className="sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className={b.status !== "confirmed" ? "muted" : ""}>
                  <td>
                    {time(b.startsAt)}–{time(b.endsAt)}
                  </td>
                  <td>{b.stylistName}</td>
                  <td>
                    {b.serviceName}
                    <br />
                    <span className="small">{price(b.priceCents)}</span>
                  </td>
                  <td>
                    {b.customerName}
                    <br />
                    <span className="small">
                      {b.customerEmail}
                      {b.customerPhone ? ` · ${b.customerPhone}` : ""}
                    </span>
                    {b.note && (
                      <>
                        <br />
                        <span className="small">« {b.note} »</span>
                      </>
                    )}
                  </td>
                  <td>{STATUS[b.status] ?? b.status}</td>
                  <td>
                    {b.status === "confirmed" && (
                      <button className="btn sm ghost" onClick={() => cancel(b)}>
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Absences({ onAuthLost }: { onAuthLost: () => void }) {
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [timeOff, setTimeOff] = useState<Period[]>([]);
  const [closures, setClosures] = useState<Period[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, t, c] = await Promise.all([
        api<Stylist[]>("/admin/stylists"),
        api<Period[]>("/admin/time-off"),
        api<Period[]>("/admin/closures"),
      ]);
      setStylists(s);
      setTimeOff(t);
      setClosures(c);
    } catch (e) {
      if ((e as ApiError).status === 401) onAuthLost();
      setError((e as Error).message);
    }
  }, [onAuthLost]);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(kind: "time-off" | "closures", e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError("");
    try {
      await api(`/admin/${kind}`, {
        method: "POST",
        json: {
          ...(kind === "time-off" ? { stylistId: f.get("stylistId") } : {}),
          startsAt: f.get("startsAt"),
          endsAt: f.get("endsAt"),
          reason: f.get("reason") ?? "",
        },
      });
      form.reset();
      void load();
    } catch (err) {
      setError(
        (err as ApiError).code === "validation_error"
          ? "Vérifiez les dates : la fin doit être après le début."
          : (err as Error).message,
      );
    }
  }
  async function remove(kind: "time-off" | "closures", id: string) {
    await api(`/admin/${kind}/${id}`, { method: "DELETE" }).catch((e: Error) => setError(e.message));
    void load();
  }
  const fmt = (p: Period) =>
    `${longDate(p.startsAt)} ${time(p.startsAt)} → ${longDate(p.endsAt)} ${time(p.endsAt)}`;

  return (
    <div className="cgrid">
      <div>
        <h2 className="h3">Absence d’un coiffeur</h2>
        <form onSubmit={(e) => add("time-off", e)}>
          <label htmlFor="ts">Coiffeur</label>
          <select id="ts" name="stylistId" required>
            {stylists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label htmlFor="tb">Début</label>
          <input id="tb" name="startsAt" type="datetime-local" required />
          <label htmlFor="te">Fin</label>
          <input id="te" name="endsAt" type="datetime-local" required />
          <label htmlFor="tr">Motif (facultatif)</label>
          <input id="tr" name="reason" maxLength={200} />
          <p />
          <button className="btn sm">Ajouter l’absence</button>
        </form>
        <ul className="periods">
          {timeOff.map((p) => (
            <li key={p.id}>
              <b>{p.stylistName}</b> : {fmt(p)} {p.reason && `(${p.reason})`}{" "}
              <button className="btn sm ghost" onClick={() => remove("time-off", p.id)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="h3">Fermeture du salon</h2>
        <form onSubmit={(e) => add("closures", e)}>
          <label htmlFor="cb">Début</label>
          <input id="cb" name="startsAt" type="datetime-local" required />
          <label htmlFor="ce2">Fin</label>
          <input id="ce2" name="endsAt" type="datetime-local" required />
          <label htmlFor="cr">Motif (facultatif)</label>
          <input id="cr" name="reason" maxLength={200} />
          <p />
          <button className="btn sm">Ajouter la fermeture</button>
        </form>
        <ul className="periods">
          {closures.map((p) => (
            <li key={p.id}>
              {fmt(p)} {p.reason && `(${p.reason})`}{" "}
              <button className="btn sm ghost" onClick={() => remove("closures", p.id)}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <p className="small">
        Les rendez-vous déjà pris pendant une absence restent dans l’agenda : annulez-les depuis l’onglet
        Agenda si besoin.
      </p>
    </div>
  );
}
