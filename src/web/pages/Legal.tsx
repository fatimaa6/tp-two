export function LegalNotice() {
  return (
    <section>
      <div className="wrap prose">
        <h1 className="h2">Mentions légales</h1>
        <p>
          <b>Site de démonstration réalisé dans le cadre d’un projet de cours.</b> Studio Sillage est un salon
          fictif : l’adresse, le téléphone, les prix et l’équipe sont des exemples.
        </p>
        <h2 className="h3">Éditeur</h2>
        <p>[Nom de l’étudiante], projet pédagogique. Contact : via le formulaire de contact.</p>
        <h2 className="h3">Hébergement</h2>
        <p>
          Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis. Base de données :
          Neon (région Europe).
        </p>
        <p className="small">Modèle de texte, sans valeur de conseil juridique.</p>
      </div>
    </section>
  );
}

export function Privacy() {
  return (
    <section>
      <div className="wrap prose">
        <h1 className="h2">Politique de confidentialité</h1>
        <p className="small">
          Version du 25 novembre 2026. Modèle pédagogique, sans valeur de conseil juridique.
        </p>
        <h2 className="h3">Données collectées</h2>
        <p>
          Pour une réservation : nom, e-mail, téléphone (facultatif), précision (facultative), prestation et
          horaire. Pour un message : nom, e-mail et message. Rien d’autre : pas de compte, pas de publicité,
          pas de cookie de mesure d’audience.
        </p>
        <h2 className="h3">Finalité et base légale</h2>
        <p>
          Gérer votre rendez-vous (confirmation, rappel la veille, annulation) et répondre à vos messages.
          Base légale : l’exécution de la prestation que vous demandez (article 6.1.b du RGPD). Les e-mails
          envoyés sont des messages de service, jamais commerciaux.
        </p>
        <h2 className="h3">Durées de conservation</h2>
        <ul>
          <li>Rendez-vous : données personnelles anonymisées 12 mois après la date du rendez-vous.</li>
          <li>Messages de contact : supprimés après 90 jours.</li>
        </ul>
        <h2 className="h3">Destinataires et sous-traitants</h2>
        <p>
          Le salon uniquement. Hébergement : Netlify (site), Neon (base de données), Google (envoi des e-mails
          via Gmail).
        </p>
        <h2 className="h3">Vos droits</h2>
        <p>
          Accès, rectification, effacement, limitation et opposition : écrivez-nous via le formulaire de
          contact. Vous pouvez aussi saisir la CNIL (cnil.fr).
        </p>
        <h2 className="h3">Cookies</h2>
        <p>
          Un seul cookie technique, réservé à l’espace d’administration du salon. Aucun cookie sur les pages
          publiques.
        </p>
      </div>
    </section>
  );
}
