const operations = new WeakMap<object, Promise<unknown>>();
const handledOffers = new WeakMap<object, Set<string>>();

export function serializePeerOperation<T>(peer: object, operation: () => Promise<T>): Promise<T> {
  const previous = operations.get(peer) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  operations.set(peer, next.catch(() => {}));
  return next;
}

export function remoteOfferHandled(peer: object, key: string): boolean {
  return handledOffers.get(peer)?.has(key) ?? false;
}

export function rememberRemoteOffer(peer: object, key: string): void {
  const seen = handledOffers.get(peer) ?? new Set<string>();
  seen.add(key);
  while (seen.size > 24) seen.delete(seen.values().next().value!);
  handledOffers.set(peer, seen);
}

export function recoveryNeedsNewPeer(state: RTCPeerConnectionState, attempt: number, forced = false): boolean {
  return forced || state === "closed" || attempt >= 3;
}

export function remoteTrackTarget(
  transceiver: RTCRtpTransceiver,
  transceivers: RTCRtpTransceiver[],
  screenVideo: RTCRtpTransceiver | null,
  screenAudio: RTCRtpTransceiver | null,
): "camera" | "screen" {
  const screen = transceiver.receiver.track.kind === "video" ? screenVideo : screenAudio;
  if (transceiver === screen) return "screen";
  // A replacement camera track has a new ID but still uses its original transceiver.
  const first = transceivers.find(item => item !== screen && item.receiver.track.kind === transceiver.receiver.track.kind);
  return transceiver === first ? "camera" : "screen";
}

export function attachRemoteTrack(all: MediaStream, camera: MediaStream, screen: MediaStream, track: MediaStreamTrack, target: "camera" | "screen"): void {
  const destination = target === "camera" ? camera : screen;
  const other = target === "camera" ? screen : camera;
  for (const old of destination.getTracks()) {
    if (old.kind === track.kind && old !== track) {
      destination.removeTrack(old);
      all.removeTrack(old);
    }
  }
  if (other.getTracks().includes(track)) other.removeTrack(track);
  if (!destination.getTracks().includes(track)) destination.addTrack(track);
  if (!all.getTracks().includes(track)) all.addTrack(track);
}
