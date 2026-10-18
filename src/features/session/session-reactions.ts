export const REACTION_TYPES = [
  "confetti",
  "applause",
  "hearts",
  "happy",
  "message",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type SessionReaction = {
  id: string;
  type: ReactionType;
  seed: number;
  text?: string;
};
export const REACTION_TEXT_LIMIT = 32;
export const REACTION_DURATION_MS = 4200;

export function reactionText(value: string): string {
  return Array.from(
    value
      .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, REACTION_TEXT_LIMIT)
    .join("");
}

export function createSessionReaction(
  type: ReactionType,
  text = "",
): SessionReaction {
  return {
    id: crypto.randomUUID(),
    type,
    seed: Math.floor(Math.random() * 0x100000000),
    ...(type === "message" ? { text: reactionText(text) } : {}),
  };
}

export function parseSessionReaction(value: unknown): SessionReaction | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<SessionReaction>;
  if (
    !REACTION_TYPES.includes(data.type as ReactionType) ||
    typeof data.id !== "string" ||
    !/^[\w:-]{1,80}$/.test(data.id) ||
    !Number.isInteger(data.seed) ||
    data.seed! < 0 ||
    data.seed! > 0xffffffff
  )
    return null;
  if (
    data.type === "message" &&
    (typeof data.text !== "string" ||
      data.text.length > 256 ||
      !reactionText(data.text))
  )
    return null;
  return {
    id: data.id,
    type: data.type!,
    seed: data.seed!,
    ...(data.type === "message" ? { text: reactionText(data.text!) } : {}),
  };
}

export function sessionReactionMessage(
  message: {
    id?: number;
    kind?: string;
    from?: string;
    payload?: unknown;
    at?: string;
  },
  joinedAt?: string,
): SessionReaction | null {
  if (
    message.from !== "admin" ||
    !["session_reaction", "confetti"].includes(message.kind || "")
  )
    return null;
  if (
    joinedAt &&
    (!Number.isFinite(Date.parse(joinedAt)) ||
      !Number.isFinite(Date.parse(message.at || "")) ||
      Date.parse(message.at!) < Date.parse(joinedAt))
  )
    return null;
  if (message.kind === "confetti") {
    if (!Number.isSafeInteger(message.id) || message.id! < 0) return null;
    return {
      id: `legacy:${message.id}`,
      type: "confetti",
      seed: message.id! >>> 0,
    };
  }
  return parseSessionReaction(message.payload);
}

export function reactionParticles(reaction: SessionReaction) {
  let state = reaction.seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const count =
    reaction.type === "confetti" ? 80 : reaction.type === "message" ? 9 : 24;
  const colors = reaction.type === "message"
    ? ["#b83e3e", "#13704d", "#9a650b", "#2b65a7", "#ac3675"]
    : ["#ef6461", "#18a66a", "#f5bc35", "#5296e6", "#e879b2"];
  return Array.from({ length: count }, (_, index) => ({
    left:
      reaction.type === "message" ? 18 + (index % 3) * 32 : 5 + random() * 90,
    top: reaction.type === "message" ? 14 + Math.floor(index / 3) * 27 : 0,
    delay: reaction.type === "message" ? index * 0.065 : random() * 0.65,
    duration: 2.5 + random() * 0.8,
    size: reaction.type === "confetti" ? 7 + random() * 7 : 28 + random() * 12,
    rotation: Math.round(random() * 40 - 20),
    drift: Math.round(random() * 40 - 20),
    color: colors[index % colors.length],
  }));
}

export function createReactionHistory() {
  const seen = new Set<string>();
  return {
    accept(id: string) {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > 128) seen.delete(seen.values().next().value!);
      return true;
    },
    clear() {
      seen.clear();
    },
  };
}
