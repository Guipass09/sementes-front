// Explicit creation context only: normal uploads, edits and assignments are untouched.
export function creationFolder(path: string, method: string, search: string): number | null {
  if (method !== "POST" || !/^\/api\/(round-games|(?:admin|professional)\/(?:activities|memory-games|phoneme-games|auditory-games|hangman-games|spin-wheel-games|word-search-games|card-games|guess-image-games))$/.test(path)) return null;
  const id = Number(new URLSearchParams(search).get("pasta"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function folderReturnPath(fallback: string, role: string, search = window.location.search): string {
  const id = Number(new URLSearchParams(search).get("pasta"));
  return Number.isSafeInteger(id) && id > 0 && ["admin", "professional"].includes(role)
    ? `${role === "admin" ? "/admin" : "/profissional"}/pastas/${id}` : fallback;
}
