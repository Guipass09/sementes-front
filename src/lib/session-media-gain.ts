// Safari's media.volume is not consistently writable. Use a gain node for live media.
type Route = { source: MediaElementAudioSourceNode; gain: GainNode; connected: boolean };
let context: AudioContext | null = null;
const routes = new WeakMap<HTMLMediaElement, Route>();
export function createSessionMediaGain() {
  const owned = new Set<HTMLMediaElement>();
  return {
    apply(media: HTMLMediaElement, volume: number) {
      const src = media.currentSrc || media.src;
      if (!src || media.srcObject) return false;
      // A source fetched without CORS would be silenced by Web Audio.
      if (!media.crossOrigin && new URL(src, location.href).origin !== location.origin) return false;
      try {
        if (!context) context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        if (context.state === "suspended") void context.resume().catch(() => {});
        let route = routes.get(media);
        if (!route) {
          const gain = context.createGain();
          route = { source: context.createMediaElementSource(media), gain, connected: false };
          routes.set(media, route);
        }
        if (!route.connected) { route.source.connect(route.gain); route.gain.connect(context.destination); route.connected = true; }
        route.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), context.currentTime, 0.025);
        owned.add(media);
        for (const old of owned) {
          if (old.isConnected) continue;
          const previous = routes.get(old)!;
          old.pause(); previous.source.disconnect(); previous.gain.disconnect(); previous.connected = false;
          owned.delete(old);
        }
        return true;
      } catch { return false; }
    },
    dispose() {
      for (const media of owned) {
        const route = routes.get(media)!;
        media.pause(); route.source.disconnect(); route.gain.disconnect(); route.connected = false;
      }
      owned.clear();
    },
  };
}
