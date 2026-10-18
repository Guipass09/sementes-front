export const APPLAUSE_SOUND_URL = "/audio/gentle-applause.mp3";
export const APPLAUSE_MAX_SECONDS = 2.8;
export const APPLAUSE_GAIN = 0.45;
export const APPLAUSE_MAX_DELAY_MS = 1200;

const recordings = new WeakMap<AudioContext, Promise<AudioBuffer>>();

function recording(context: AudioContext): Promise<AudioBuffer> {
  const cached = recordings.get(context);
  if (cached) return cached;
  const pending = fetch(APPLAUSE_SOUND_URL)
    .then((response) => {
      if (!response.ok) throw new Error("Applause recording unavailable");
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .catch((error) => {
      recordings.delete(context);
      throw error;
    });
  recordings.set(context, pending);
  return pending;
}

export async function playRecordedApplause(
  context: AudioContext,
  target: GainNode,
  isCurrent: () => boolean,
): Promise<void> {
  const requestedAt = Date.now();
  try {
    const buffer = await recording(context);
    // A download must not resurrect a reaction replaced or muted in the meantime.
    if (!isCurrent() || Date.now() - requestedAt > APPLAUSE_MAX_DELAY_MS)
      return;
    const offset = Math.min(0.06, buffer.duration / 4);
    const duration = Math.min(APPLAUSE_MAX_SECONDS, buffer.duration - offset);
    if (duration < 0.1) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    const start = context.currentTime + 0.01;
    const attack = Math.min(0.04, duration / 4);
    const release = Math.min(0.4, duration / 3);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(APPLAUSE_GAIN, start + attack);
    gain.gain.setValueAtTime(APPLAUSE_GAIN, start + duration - release);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(target);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(start, offset, duration);
  } catch {
    // Keep the visual reaction, without falling back to the harsh synthetic claps.
  }
}
