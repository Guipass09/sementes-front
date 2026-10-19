import { useEffect, type RefObject } from "react";
import { fitSessionContent } from "./session-content-fit";

// Read only the current same-origin player, never game artwork or an unrelated iframe.
export function useSessionContentFit(frameRef: RefObject<HTMLIFrameElement>, areaRef: RefObject<HTMLDivElement>, key: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const area = areaRef.current;
    const slot = area?.parentElement;
    const frame = frameRef.current;
    if (!area || !slot) return;
    const grid = slot.closest<HTMLElement>(".sc-session-grid");
    const controls = grid?.parentElement?.querySelector<HTMLElement>(".sc-session-controls");
    const cameras = grid?.querySelector<HTMLElement>(".sc-session-cams-inner");
    const cameraHeaders = Array.from(cameras?.querySelectorAll<HTMLElement>(".sc-camera-header") || []);
    let documentObserver: MutationObserver | undefined;
    let frameDocument: Document | null = null;
    let scheduled = 0;

    const measure = () => {
      scheduled = 0;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const portraitMobile = window.innerWidth < 1024 && window.innerHeight > window.innerWidth;
      const top = slot.getBoundingClientRect().top + window.scrollY;
      const availableHeight = portraitMobile
        ? Math.max(240, Math.min(viewportHeight * 0.6, viewportHeight - top - (controls?.offsetHeight || 48) - 24))
        : Math.max(180, viewportHeight - top - (controls?.offsetHeight || 48) - 24);
      const media = frameDocument?.querySelector<HTMLImageElement | HTMLVideoElement>(".story-stage-content > img, .story-stage-content > video, .session-activity-media[data-session-active=true] > img, .session-activity-media[data-session-active=true] > video");
      let ratio: number | null = null;
      if (media?.tagName === "IMG") {
        const image = media as HTMLImageElement;
        ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : null;
      } else if (media?.tagName === "VIDEO") {
        const video = media as HTMLVideoElement;
        ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : null;
      } else ratio = null;
      const fit = fitSessionContent(slot.clientWidth, availableHeight, ratio);
      // The slot is measured independently of the fitted player, avoiding resize feedback.
      slot.style.height = `${fit.height}px`;
      area.style.width = `${fit.width}px`;
      area.style.height = `${fit.height}px`;
      const gridTop = (grid?.getBoundingClientRect().top || 0) + window.scrollY;
      const cameraHeight = Math.max(180, viewportHeight - gridTop - (controls?.offsetHeight || 48) - 24);
      const cameraChrome = cameraHeaders.reduce((height, header) => height + header.offsetHeight, 0) + 12;
      grid?.style.setProperty("--session-camera-height", `${cameraHeight}px`);
      grid?.style.setProperty("--session-camera-chrome", `${cameraChrome}px`);
    };
    const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(measure); };
    const disconnectDocument = () => {
      documentObserver?.disconnect();
      frameDocument?.removeEventListener("load", schedule, true);
      frameDocument?.removeEventListener("loadedmetadata", schedule, true);
      frameDocument = null;
    };
    const attach = () => {
      disconnectDocument();
      try { frameDocument = frame?.contentDocument || null; } catch { /* External content keeps the responsive default. */ }
      if (frameDocument) {
        documentObserver = new MutationObserver(schedule);
        documentObserver.observe(frameDocument, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "data-session-active"] });
        frameDocument.addEventListener("load", schedule, true);
        frameDocument.addEventListener("loadedmetadata", schedule, true);
      }
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(slot);
    if (slot.parentElement) observer.observe(slot.parentElement);
    if (controls) observer.observe(controls);
    if (grid?.previousElementSibling) observer.observe(grid.previousElementSibling);
    cameraHeaders.forEach(header => observer.observe(header));
    const navigation = slot.parentElement?.querySelector(".story-navigation");
    if (navigation) observer.observe(navigation);
    frame?.addEventListener("load", attach);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    attach();
    return () => {
      cancelAnimationFrame(scheduled);
      observer.disconnect();
      disconnectDocument();
      frame?.removeEventListener("load", attach);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      slot.style.removeProperty("height");
      area.style.removeProperty("width");
      area.style.removeProperty("height");
      grid?.style.removeProperty("--session-camera-height");
      grid?.style.removeProperty("--session-camera-chrome");
    };
  }, [frameRef, areaRef, key, ready]);
}
