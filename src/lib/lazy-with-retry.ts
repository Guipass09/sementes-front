import { lazy } from "react";

/**
 * Evita o erro clássico após deploy (PWA/Cache): "Failed to fetch dynamically imported module".
 * Estratégia:
 * - tenta carregar o chunk
 * - se falhar, limpa cache e faz 1 reload com cache-buster
 * - se falhar novamente, propaga o erro para o ErrorBoundary
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (e: any) {
      const isChunkError = 
        e?.message?.includes("Failed to fetch dynamically imported module") ||
        e?.message?.includes("dynamically imported module") ||
        e?.name === "ChunkLoadError";
      
      if (isChunkError) {
        try {
          const k = `__lazy_retry__:${key}`;
          const retryCount = typeof window !== "undefined" ? 
            Number(window.sessionStorage?.getItem(k) || "0") : 0;
          
          // Limpa caches do Service Worker se disponível
          if (typeof window !== "undefined" && (window as any).caches) {
            try {
              const cacheNames = await (window as any).caches.keys();
              await Promise.all(cacheNames.map((name: string) => (window as any).caches.delete(name)));
            } catch {
              // ignore
            }
          }
          
          // Limpa cache do navegador (hard reload)
          if (retryCount < 2 && typeof window !== "undefined") {
            window.sessionStorage?.setItem(k, String(retryCount + 1));
            const url = new URL(window.location.href);
            url.searchParams.set("__reload", String(Date.now()));
            url.searchParams.set("__hard", "1");
            window.location.replace(url.toString());
            // impede render enquanto recarrega
            return await new Promise<{ default: T }>(() => {});
          } else {
            // Após 2 tentativas, limpa a flag e propaga o erro
            if (typeof window !== "undefined") {
              window.sessionStorage?.removeItem(k);
            }
          }
        } catch {
          // ignore
        }
      }
      throw e;
    }
  });
}

