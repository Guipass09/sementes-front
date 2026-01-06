import { API_BASE_URL } from "../services/api";

export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return "";

  if (url.startsWith("http")) return url;

  if (url.startsWith("/storage/")) {
    return `${API_BASE_URL}${url}`;
  }

  return url;
}


