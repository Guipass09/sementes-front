type GameMedia = {
  muted: boolean;
  volume?: number;
  isConnected: boolean;
  pause?: () => void;
};

export function createGameMediaMute<T extends GameMedia>(
  elements: () => Iterable<T>,
) {
  const original = new Map<T, boolean>();
  const originalVolumes = new Map<T, number>();
  return {
    apply(muted: boolean, volume = 1) {
      for (const [media, previous] of originalVolumes) {
        if (!media.isConnected) {
          media.pause?.();
          media.volume = previous;
          originalVolumes.delete(media);
        }
      }
      for (const [media, previous] of original) {
        if (!media.isConnected) media.pause?.();
        if (!media.isConnected || !muted) {
          media.muted = previous;
          original.delete(media);
        }
      }
      for (const media of elements()) {
        if (typeof media.volume === "number") {
          if (!originalVolumes.has(media))
            originalVolumes.set(media, media.volume);
          const target = Math.max(0, Math.min(1, volume));
          if (media.volume !== target) media.volume = target;
        }
        if (muted) {
          if (!original.has(media)) original.set(media, media.muted);
          if (!media.muted) media.muted = true;
        }
      }
    },
    dispose() {
      for (const [media, previous] of original) media.muted = previous;
      original.clear();
      for (const [media, previous] of originalVolumes) media.volume = previous;
      originalVolumes.clear();
    },
  };
}
