export function getFullscreenPortalContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const doc: any = document;
  const native = (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) as HTMLElement | null;
  if (native) return native;
  const pseudo = document.querySelector(".fs-target.is-pseudo-fullscreen") as HTMLElement | null;
  return pseudo;
}


