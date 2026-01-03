export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof window === "undefined") return url;

  try {
    const u = new URL(url, window.location.origin);

    // Para mídias do Laravel storage, sempre use o host atual.
    // Isso evita "localhost" quebrando no celular e mantém o proxy do Vite (/storage) funcionando.
    if (u.pathname.startsWith("/storage/")) {
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
    }

    return url;
  } catch {
    return url;
  }
}


