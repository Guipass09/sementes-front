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
    const config = error?.config || {};
    if (!response) return Promise.reject(error);

    // Normalize request url path for checks
    const url = (config.url || "").toString();

    // Ignore events for the CSRF cookie endpoint and login endpoint
    const isCsrfEndpoint = url.includes("/sanctum/csrf-cookie");
    const isLoginEndpoint = url.includes("/api/login");

    if (response.status === 419) {
      // Do not handle CSRF endpoint itself
      if (isCsrfEndpoint || isLoginEndpoint) return Promise.reject(error);

      // Avoid double-handling the same request
      if (config.__handled419) return Promise.reject(error);

      try {
        config.__handled419 = true;
        window.dispatchEvent(new CustomEvent("api:csrf", { detail: { path: url } }));
      } catch {}

      return Promise.reject(error);
    }

    if (response.status === 401) {
      // Do not dispatch for login or csrf endpoints
      if (isCsrfEndpoint || isLoginEndpoint) return Promise.reject(error);

      try {
        window.dispatchEvent(new CustomEvent("api:unauthorized", { detail: { path: url } }));
      } catch {}
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
