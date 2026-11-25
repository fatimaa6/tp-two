import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { longDate, price, time } from "../format";

interface ManagedBooking {
  id: string;
  status: string;
  startsAt: string;
  serviceName: string;
  stylistName: string;
  priceCents: number;
  customerName: string;
  canCancel: boolean;
}

/** Page du lien privé. Le jeton est lu dans le fragment (#t=…) puis retiré de la barre d'adresse. */
export default function Manage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "");
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    if (!token) return setError("Lien incomplet. Ouvrez le lien reçu par e-mail.");
    api<ManagedBooking>("/manage/booking", { headers: { "x-manage-token": token } })
      .then(setBooking)
      .catch((e: ApiError) => setError(e.message));
  }, [token]);

  async function cancel() {
    if (!window.confirm("Annuler ce rendez-vous ?")) return;
    setBusy(true);
    setError("");
    try {
      await api("/manage/booking/cancel", { method: "POST", headers: { "x-manage-token": token } });
      setBooking((b) => (b ? { ...b, status: "cancelled_by_client", canCancel: false } : b));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const STATUS: Record<string, string> = {
    confirmed: "Confirmé",
    cancelled_by_client: "Annulé par vous",
    cancelled_by_salon: "Annulé par le salon",
    completed: "Terminé",
    no_show: "Absent",
  };

  return (
    <section className="book">
      <div className="wrap">
        <h1 className="h2">Mon rendez-vous</h1>
        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        {booking && (
          <div className="ok">
            <p>
              <b>{booking.serviceName}</b> avec {booking.stylistName}
              <br />
              le{" "}
              <b>
                {longDate(booking.startsAt)} à {time(booking.startsAt)}
              </b>{" "}
              · {price(booking.priceCents)}
            </p>
            <p>
              Statut : <b>{STATUS[booking.status] ?? booking.status}</b>
            </p>
            {booking.canCancel && (
              <button className="btn" onClick={cancel} disabled={busy}>
                {busy ? "Annulation…" : "Annuler ce rendez-vous"}
              </button>
            )}
            {booking.status === "confirmed" && !booking.canCancel && (
              <p>
                Le rendez-vous est dans moins de 24 heures : pour annuler, appelez le salon au 01 23 45 67 89.
              </p>
            )}
          </div>
        )}
        <p>
          <Link to="/reserver">Prendre un autre rendez-vous</Link>
        </p>
      </div>
    </section>
  );
}
