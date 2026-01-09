import axios from "axios";

// Base URL fixa da API (backend roda exclusivamente aqui)
export const API_BASE_URL = "https://api.sementesdafala.com.br";

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
  (error) => {
    const response = error?.response;
    const config = error?.config || {};
    if (!response) return Promise.reject(error);

    const url = (config.url || "").toString();

    // Avoid interfering with login endpoint itself
    if (response.status === 401) {
      try {
        if (!url.includes("/api/login")) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          // hard redirect to login
          try {
            window.location.replace("/entrar");
          } catch (e) {
            // no-op
          }
        }
      } catch {}
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
