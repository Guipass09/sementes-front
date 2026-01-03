import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const DEV_PORT = Number(process.env.VITE_PORT || 5173);
const BACKEND_PORT = Number(process.env.VITE_BACKEND_PORT || 8000);
const BACKEND_ORIGIN = process.env.VITE_BACKEND_ORIGIN || `http://localhost:${BACKEND_PORT}`;
const HMR_HOST = process.env.VITE_HMR_HOST || "localhost";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Escuta na rede para permitir acesso pelo celular (mesmo Wi‑Fi).
    host: "0.0.0.0",
    port: DEV_PORT,
    // Evita o Vite "pular" para 5174/5175 (o que costuma quebrar CORS/Sanctum quando o backend
    // está liberando apenas a porta 5173).
    strictPort: true,
    headers: {
      // Evita cache agressivo no dev (ajuda quando o Chrome insiste em manter assets antigos)
      "Cache-Control": "no-store",
    },
    // Em alguns Macs/FS, eventos de arquivo podem falhar e o HMR parece "não atualizar".
    // Polling deixa o dev mais robusto (custa um pouco mais de CPU).
    watch: {
      usePolling: true,
      interval: 150,
    },
    hmr: {
      // Em desktop, localhost é suficiente. Para celular (LAN), defina VITE_HMR_HOST=SEU_IP.
      host: HMR_HOST,
      port: DEV_PORT,
    },
    // Proxy no dev: elimina CORS e faz cookies/Sanctum funcionarem como "same-origin".
    // O frontend chama /api/* e /sanctum/* e o Vite encaminha para o Laravel em :8000.
    proxy: {
      "/api": {
        target: BACKEND_ORIGIN,
        // Mantém o Host original (ex: 192.168.x.x:5173 no celular) para o backend gerar URLs corretas.
        changeOrigin: false,
      },
      "/sanctum": {
        target: BACKEND_ORIGIN,
        changeOrigin: false,
      },
      // Útil para servir mídias do storage sem precisar de URL absoluta no dev.
      "/storage": {
        target: BACKEND_ORIGIN,
        changeOrigin: false,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
