import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const DEV_PORT = Number(process.env.VITE_PORT || 5173);
const HMR_HOST = process.env.VITE_HMR_HOST;

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
      // Se precisar expor HMR fora da máquina local, defina VITE_HMR_HOST.
      ...(HMR_HOST ? { host: HMR_HOST } : {}),
      port: DEV_PORT,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
