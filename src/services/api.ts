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

let isRefreshingCsrf = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const response = error?.response;
    const config = error?.config || {};
    if (!response) return Promise.reject(error);

    // CSRF expired / session expired in Laravel returns 419
    if (response.status === 419) {
      try {
        window.dispatchEvent(new CustomEvent("api:csrf"));
      } catch {}

      // try to refresh CSRF cookie once and retry the original request
      if (config.__csrfRetried) return Promise.reject(error);

      try {
        if (!isRefreshingCsrf) {
          isRefreshingCsrf = true;
          await api.get("/sanctum/csrf-cookie");
          isRefreshingCsrf = false;
        }
        config.__csrfRetried = true;
        return api.request(config);
      } catch (e) {
        isRefreshingCsrf = false;
        return Promise.reject(error);
      }
    }

    // Unauthorized
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
