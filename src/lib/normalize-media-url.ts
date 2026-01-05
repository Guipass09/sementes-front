const API_URL = "https://api.sementesdafala.com.br";

export function normalizeMediaUrl(
  url: string | null | undefined
): string {
  if (!url) return "";

  // já é absoluta
  if (url.startsWith("http")) {
    return url;
  }

  // imagens do Laravel (storage)
  if (url.startsWith("/storage/")) {
    return `${API_URL}${url}`;
  }

  // fallback seguro
  return url;
}


