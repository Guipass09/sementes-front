import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Registra service worker para permitir "instalar" como app (PWA).
// Importante: em DEV (vite), o SW pode atrapalhar hot-reload; por isso só habilitamos em produção.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  if (!import.meta.env.DEV) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // silencioso
      });
    });
  }
}
