import { lazy } from "react";

/**
 * Evita o erro clássico após deploy (PWA/Cache): "Failed to fetch dynamically imported module".
 * Estratégia:
 * - tenta carregar o chunk
 * - se falhar, faz 1 reload com cache-buster e bloqueia o render
 * - se falhar novamente, propaga o erro para o ErrorBoundary
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (e) {
      try {
        const k = `__lazy_retry__:${key}`;
        const already = typeof window !== "undefined" && window.sessionStorage?.getItem(k);
        if (!already && typeof window !== "undefined") {
          window.sessionStorage?.setItem(k, "1");
          const url = new URL(window.location.href);
          url.searchParams.set("__reload", String(Date.now()));
          window.location.replace(url.toString());
          // impede render enquanto recarrega
          return await new Promise<{ default: T }>(() => {});
        }
      } catch {
        // ignore
      }
      throw e;
    }
  });
}

