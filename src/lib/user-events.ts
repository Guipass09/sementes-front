const USER_PROGRESS_CHANGED_EVENT = "user-progress-changed";

export function emitUserProgressChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_PROGRESS_CHANGED_EVENT));
}

export function onUserProgressChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(USER_PROGRESS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(USER_PROGRESS_CHANGED_EVENT, listener);
}


