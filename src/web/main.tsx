import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import "@fontsource/young-serif/400.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/600.css";
import "./styles/global.css";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import Book from "./pages/Book";
import Manage from "./pages/Manage";
import Admin from "./pages/admin/Admin";
import { LegalNotice, Privacy } from "./pages/Legal";

const TITLES: Record<string, string> = {
  "/": "Studio Sillage – Salon de coiffure à Paris",
  "/reserver": "Réserver – Studio Sillage",
  "/gerer": "Mon rendez-vous – Studio Sillage",
  "/mentions-legales": "Mentions légales – Studio Sillage",
  "/confidentialite": "Confidentialité – Studio Sillage",
  "/admin": "Espace salon – Studio Sillage",
};

function PageTitle() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? "Studio Sillage";
    if (!hash || pathname === "/gerer") window.scrollTo(0, 0);
    else document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [pathname, hash]);
  return null;
}

function NotFound() {
  return (
    <section>
      <div className="wrap">
        <h1 className="h2">Page introuvable</h1>
        <p>
          <a href="/">Retour à l’accueil</a>
        </p>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PageTitle />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/reserver" element={<Book />} />
          <Route path="/gerer" element={<Manage />} />
          <Route path="/mentions-legales" element={<LegalNotice />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
);
