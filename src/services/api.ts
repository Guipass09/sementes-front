import axios from "axios";

export const API_BASE_URL = "https://api.sementesdafala.com.br";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Centralized error events without triggering CSRF refresh or login flows here.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const response = error?.response;
    if (!response) return Promise.reject(error);

    if (response.status === 419) {
      try {
        window.dispatchEvent(new CustomEvent("api:csrf"));
      } catch {}
      return Promise.reject(error);
    }

    if (response.status === 401) {
      try {
        window.dispatchEvent(new CustomEvent("api:unauthorized", { detail: { path: window.location.pathname } }));
      } catch {}
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
