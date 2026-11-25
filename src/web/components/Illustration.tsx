/** Illustrations vectorielles de la démo (aucune photo réelle). */
type Cut = "long" | "bob" | "short";

export function Head({ hair, skin, cut }: { hair: string; skin: string; cut: Cut }) {
  return (
    <svg viewBox="0 0 120 150" aria-hidden="true" focusable="false">
      {cut === "long" && <path d="M28 72C26 18 94 18 92 72L98 150H22Z" fill={hair} />}
      {cut === "bob" && <path d="M28 70C26 18 94 18 92 70L94 108H26Z" fill={hair} />}
      <path d="M14 150C16 122 38 116 60 116s44 6 46 34Z" fill="#7C4A91" />
      <rect x="51" y="92" width="18" height="28" rx="6" fill={skin} />
      <ellipse cx="60" cy="68" rx="25" ry="30" fill={skin} />
      <path d="M34 66C30 28 90 28 86 66C80 50 70 44 60 44S40 50 34 66Z" fill={hair} />
    </svg>
  );
}

export const GALLERY: { hair: string; skin: string; cut: Cut; from: string; to: string; label: string }[] = [
  { hair: "#5A3A22", skin: "#E8B896", cut: "long", from: "#FFE9F2", to: "#F7C6DC", label: "Chocolat glacé" },
  { hair: "#D9A74A", skin: "#F2C9A5", cut: "long", from: "#FFF2D9", to: "#F8D9A0", label: "Balayage miel" },
  { hair: "#B5532A", skin: "#F0C4A0", cut: "bob", from: "#FFE6DA", to: "#F6BFA2", label: "Cuivre naturel" },
  { hair: "#2A2230", skin: "#B98462", cut: "short", from: "#E6ECFA", to: "#BFCDF0", label: "Dégradé net" },
  { hair: "#D9889F", skin: "#F5D2B8", cut: "bob", from: "#FFE3EC", to: "#F7B9CF", label: "Rose poudré" },
  { hair: "#B9B4AE", skin: "#EBC3A3", cut: "long", from: "#EFEFF5", to: "#D3D3E4", label: "Blond cendré" },
];

export const AVATARS: Record<string, { hair: string; skin: string; cut: Cut }> = {
  ines: { hair: "#C98E4B", skin: "#F2C9A5", cut: "long" },
  malik: { hair: "#2A2230", skin: "#B98462", cut: "short" },
  camille: { hair: "#8A4B2A", skin: "#F0C4A0", cut: "bob" },
};

export function SalonMap() {
  return (
    <svg
      className="map"
      viewBox="0 0 600 380"
      role="img"
      aria-label="Plan schématique : le salon est rue des Petits-Champs, près de la station Pyramides"
    >
      <rect width="600" height="380" fill="#F3ECF6" />
      <rect x="390" y="30" width="180" height="80" rx="10" fill="#D5EBD3" />
      <path d="M0 335C150 305 300 355 600 315V380H0Z" fill="#C4DDF0" />
      <g fill="#fff">
        <rect y="243" width="600" height="14" />
        <rect y="190" width="600" height="10" />
        <rect y="125" width="600" height="10" />
        <path d="M240 380L350 0" stroke="#fff" strokeWidth="16" />
      </g>
      <g fontSize="13" fill="#6B5B73" fontFamily="sans-serif">
        <text x="430" y="75">
          Palais-Royal
        </text>
        <text x="20" y="236">
          rue de Rivoli
        </text>
        <text x="20" y="184">
          rue Saint-Honoré
        </text>
        <text x="20" y="119">
          rue des Petits-Champs
        </text>
        <text x="30" y="345">
          La Seine
        </text>
        <text x="350" y="300">
          avenue de l’Opéra
        </text>
      </g>
      <circle cx="296" cy="195" r="13" fill="#6B5B73" />
      <text
        x="296"
        y="200"
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        fill="#fff"
        fontFamily="sans-serif"
      >
        M
      </text>
      <text x="316" y="218" fontSize="13" fill="#2B1F33" fontFamily="sans-serif">
        Pyramides
      </text>
      <path d="M312 128c-14-20-22-30-22-42a22 22 0 0144 0c0 12-8 22-22 42z" fill="#B43E8F" />
      <circle cx="312" cy="86" r="8" fill="#fff" />
    </svg>
  );
}
