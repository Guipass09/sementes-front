import type { MouthPose } from "./createMouthModel";

export const MOUTH_DEMOS = [
  { id: "trill", label: "Vibração contínua da ponta · /r/", group: "Língua", cue: "Observe a vibração da ponta da língua.", continuous: true },
  { id: "ra", label: "RA · RA · RA com ponta vibrante", group: "Língua", cue: "A ponta vibra e a boca abre para o A.", continuous: false },
  { id: "tap", label: "ARA · toque curto /ɾ/", group: "Língua", cue: "Um toque rápido da ponta entre as vogais.", continuous: false },
  { id: "la", label: "LA · LA · LA", group: "Língua", cue: "A ponta se eleva e retorna para a vogal.", continuous: false },
  { id: "ta", label: "TA · TA · TA", group: "Língua", cue: "Contato da língua seguido da abertura para o A.", continuous: false },
  { id: "da", label: "DA · DA · DA", group: "Língua", cue: "Contato da língua seguido da abertura para o A.", continuous: false },
  { id: "pa", label: "PA · PA · PA", group: "Lábios", cue: "Os lábios se fecham e se abrem para o A.", continuous: false },
  { id: "ba", label: "BA · BA · BA", group: "Lábios", cue: "Os lábios se fecham e se abrem para o A.", continuous: false },
  { id: "ma", label: "MA · MA · MA", group: "Lábios", cue: "Fechamento dos lábios seguido da vogal A.", continuous: false },
  { id: "s", label: "S · som prolongado", group: "Sons prolongados", cue: "Observe a língua próxima aos dentes, sem vibração da ponta.", continuous: true },
] as const;
export type MouthDemoId = typeof MOUTH_DEMOS[number]["id"];
export const DEMO_SPEEDS = [0.5, 0.75, 1] as const;
export const MOUTH_DEMO_DURATION = 3000;
export const MOUTH_DEMO_LEASE = 5500;
export type MouthDemoState = {
  id: string; preset: MouthDemoId; status: "playing" | "paused";
  position: number; startedAt: number; speed: number; repeat: boolean; volume: number; muted: boolean; expiresAt: number;
};

export function normalizeMouthDemo(value: unknown): MouthDemoState | null {
  if (!value || typeof value !== "object") return null;
  const d = value as MouthDemoState;
  if (typeof d.id !== "string" || !/^[\w-]{1,80}$/.test(d.id) || !MOUTH_DEMOS.some(p => p.id === d.preset) ||
    !["playing", "paused"].includes(d.status) || !DEMO_SPEEDS.includes(d.speed as typeof DEMO_SPEEDS[number]) ||
    ![d.position, d.startedAt, d.volume, d.expiresAt].every(Number.isFinite) || d.position < 0 || d.position > MOUTH_DEMO_DURATION ||
    d.startedAt < 0 || d.expiresAt < 0 || d.volume < 0 || d.volume > 1 || typeof d.repeat !== "boolean" || typeof d.muted !== "boolean") return null;
  return { id: d.id, preset: d.preset, status: d.status, position: d.position, startedAt: d.startedAt, speed: d.speed,
    repeat: d.repeat, volume: d.volume, muted: d.muted, expiresAt: d.expiresAt };
}

export function mouthDemoPosition(demo: MouthDemoState, now: number): number {
  const position = demo.position + (demo.status === "playing" ? Math.max(0, now - demo.startedAt) * demo.speed : 0);
  return demo.repeat ? position % MOUTH_DEMO_DURATION : Math.min(MOUTH_DEMO_DURATION, position);
}
export function mouthDemoPlaying(demo: MouthDemoState | null | undefined, now: number, leased = false): boolean {
  return !!demo && demo.status === "playing" && now >= demo.startedAt && (!leased || (demo.expiresAt > now && demo.expiresAt - now <= MOUTH_DEMO_LEASE + 2000)) &&
    (demo.repeat || mouthDemoPosition(demo, now) < MOUTH_DEMO_DURATION);
}
export function mouthDemoAsset(preset: MouthDemoId, speed: number): string {
  return `/audio/mouth3d/${preset}-${speed === 0.5 ? "slow" : speed === 0.75 ? "gentle" : "normal"}.mp3`;
}

// Time is sampled inside the 3D render loop, without broadcasting frames or changing the manual pose.
export function mouthDemoPose(preset: MouthDemoId, ms: number): MouthPose {
  const t = (ms % 1000) / 1000;
  const contact = t >= 0.07 && t < 0.25;
  const vowel = t >= 0.25 && t < 0.72;
  const base: MouthPose = { opening: 0.48, tongueLift: 0.25, tongueReach: 0.26, tongueCurl: 0, tongueSide: 0, tongueWidth: 0, lipShape: 0 };
  if (preset === "trill") return { ...base, opening: 0.58, tongueLift: 0.85, tongueReach: 0.42, tongueCurl: 0.15 + Math.sin(ms / 1000 * Math.PI * 36) * 0.09 };
  if (preset === "s") return { ...base, opening: 0.10, tongueLift: 0.42, tongueReach: 0.42, tongueWidth: -0.12 };
  if (preset === "pa" || preset === "ba" || preset === "ma") return { ...base, opening: contact ? 0 : vowel ? 0.73 : 0.16 };
  if (preset === "tap") {
    const tap = t >= 0.3 && t < 0.35;
    return { ...base, opening: 0.58, tongueLift: tap ? 0.91 : 0.2, tongueReach: tap ? 0.4 : 0.24, tongueCurl: tap ? 0.16 : 0 };
  }
  return { ...base, opening: vowel ? 0.73 : 0.52, tongueLift: contact ? 0.9 : 0.22, tongueReach: contact ? 0.43 : 0.26,
    tongueCurl: contact ? preset === "ra" ? 0.16 + Math.sin(ms / 1000 * Math.PI * 36) * 0.09 : 0.12 : 0 };
}

export function changeMouthDemo(demo: MouthDemoState, patch: Partial<MouthDemoState>, now: number): MouthDemoState {
  return { ...demo, position: mouthDemoPosition(demo, now), startedAt: now, ...patch };
}
