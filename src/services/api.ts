import axios from "axios";

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  // O frontend já chama endpoints como "/api/login".
  // Se alguém configurar VITE_API_URL com "/api", evitamos ficar "/api/api/...".
  if (trimmed.endsWith("/api")) return trimmed.slice(0, -4);
  return trimmed;
}

// Base URL da API:
// - Produção/Vercel: definir VITE_API_URL (sem "/api" e sem "/" no final)
// - Fallback: domínio oficial
export const API_BASE_URL = normalizeApiBaseUrl(
  (import.meta as any)?.env?.VITE_API_URL || "https://api.sementesdafala.com.br"
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Attach Bearer token from localStorage to every request
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// On 401: clear token/user and redirect to login. Do NOT retry.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const response = error?.response;
    const config = error?.config || {};
    if (!response) return Promise.reject(error);

    const url = (config.url || "").toString();

    // Se o backend estiver sem o prefixo "/api" (deploy/roteamento),
    // tentamos automaticamente a mesma rota sem "/api".
    // Ex.: /api/login -> /login
    if (
      response.status === 404 &&
      !(config as any).__apiPrefixRetried &&
      typeof url === "string" &&
      url.startsWith("/api/")
    ) {
      try {
        (config as any).__apiPrefixRetried = true;
        config.url = url.replace(/^\/api/, "");
        return await api.request(config);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    // Avoid interfering with login endpoint itself
    // Só faz logout automático em 401 se NÃO for na página de login/registro
    // E só redireciona se o usuário estiver tentando acessar uma página protegida
    if (response.status === 401) {
      try {
        const isAuthEndpoint = url.includes("/login") || url.includes("/register") || url.includes("/me");
        const isOnAuthPage = window.location.pathname.includes("/entrar") || 
                            window.location.pathname.includes("/cadastro") ||
                            window.location.pathname.includes("/esqueci-senha");
        
        // Só limpa e redireciona se não for endpoint de auth e não estiver em página de auth
        if (!isAuthEndpoint && !isOnAuthPage) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.replace("/entrar");
        }
      } catch {}
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
