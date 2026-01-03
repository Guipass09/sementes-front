const ADMIN_DATA_CHANGED_EVENT = "admin-data-changed";

export function emitAdminDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ADMIN_DATA_CHANGED_EVENT));
}

export function onAdminDataChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(ADMIN_DATA_CHANGED_EVENT, listener);
  return () => window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, listener);
}










