/**
 * Eventos de loading da API.
 *
 * OBS: Mantido como compatibilidade, mas sem listeners por padrão.
 * O overlay de loading foi desativado para não atrapalhar jogos.
 */
const API_LOADING_CHANGED_EVENT = "api-loading-changed";

export function emitApiLoadingChanged(count: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(API_LOADING_CHANGED_EVENT, { detail: { count } }));
}

export function onApiLoadingChanged(handler: (count: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ev = e as CustomEvent;
    const c = Number((ev as any)?.detail?.count ?? 0);
    handler(Number.isFinite(c) ? c : 0);
  };
  window.addEventListener(API_LOADING_CHANGED_EVENT, listener as any);
  return () => window.removeEventListener(API_LOADING_CHANGED_EVENT, listener as any);
}


