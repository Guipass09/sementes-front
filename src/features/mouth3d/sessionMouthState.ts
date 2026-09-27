import type { MouthPose } from "./createMouthModel";
import type { MouthView } from "./MouthModelScene";

export type SessionMouthState = {
  open: boolean;
  pose: MouthPose;
  view: MouthView;
  showFace: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const initialSessionMouthState: SessionMouthState = {
  open: false,
  pose: { opening: 0.85, tongueLift: 0.12, tongueReach: 0.25, tongueCurl: 0, tongueSide: 0, tongueWidth: 0, lipShape: 0 },
  view: "front",
  showFace: true,
  x: 0.14,
  y: 0.12,
  w: 0.72,
  h: 0.76,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;

export function normalizeSessionMouthState(value: unknown): SessionMouthState {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pose = input.pose && typeof input.pose === "object" ? input.pose as Record<string, unknown> : {};
  const w = bounded(input.w, initialSessionMouthState.w, 0.28, 0.95);
  const h = bounded(input.h, initialSessionMouthState.h, 0.3, 0.95);
  return {
    open: input.open === true,
    pose: {
      opening: bounded(pose.opening, initialSessionMouthState.pose.opening, 0, 1),
      tongueLift: bounded(pose.tongueLift, initialSessionMouthState.pose.tongueLift, 0, 1),
      tongueReach: bounded(pose.tongueReach, initialSessionMouthState.pose.tongueReach, 0, 1),
      tongueCurl: bounded(pose.tongueCurl, 0, -1, 1),
      tongueSide: bounded(pose.tongueSide, 0, -1, 1),
      tongueWidth: bounded(pose.tongueWidth, 0, -1, 1),
      lipShape: bounded(pose.lipShape, 0, -1, 1),
    },
    view: input.view === "angle" || input.view === "section" ? input.view : "front",
    showFace: input.showFace !== false,
    x: bounded(input.x, initialSessionMouthState.x, 0, 1 - w),
    y: bounded(input.y, initialSessionMouthState.y, 0, 1 - h),
    w,
    h,
  };
}
