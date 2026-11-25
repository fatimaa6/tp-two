import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En local, `netlify dev` sert le front et les fonctions sur la même origine.
// `npm run dev` seul sert le front ; l'API est alors proxifiée vers `netlify dev` (port 8888).
export default defineConfig({
  plugins: [react()],
  root: ".",
  build: { outDir: "dist", sourcemap: true },
  server: { proxy: { "/api": "http://localhost:8888" } },
});
