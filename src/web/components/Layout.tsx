import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const anchor = (id: string) => (pathname === "/" ? `#${id}` : `/#${id}`);
  return (
    <>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <header>
        <div className="wrap bar">
          <Link className="logo" to="/">
            Studio Sillage
          </Link>
          <button className="menu" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            Menu
          </button>
          <nav
            id="nav"
            className={open ? "open" : ""}
            aria-label="Navigation principale"
            onClick={() => setOpen(false)}
          >
            <a href={anchor("tarifs")}>Tarifs</a>
            <a href={anchor("equipe")}>Équipe</a>
            <a href={anchor("realisations")}>Réalisations</a>
            <a href={anchor("infos")}>Infos</a>
            <a href={anchor("contact")}>Contact</a>
            <NavLink className="btn sm" to="/reserver">
              Réserver
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="contenu" tabIndex={-1}>
        {children}
      </main>
      <footer className="site">
        <div className="wrap">
          <p>© 2026 Studio Sillage, 12 rue des Petits-Champs, 75001 Paris. Salon fictif : projet de cours.</p>
          <p>
            <Link to="/mentions-legales">Mentions légales</Link> ·{" "}
            <Link to="/confidentialite">Confidentialité</Link> · <Link to="/admin">Espace salon</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
