export type GameNoticeState = {
  known: string[];
  pending: string[];
};

export const gameNoticeKey = (categoryId: string, gameId: number) => `${categoryId}:${gameId}`;

const noticeStorageKey = (userId: number) => `sementes:patient-game-notices:v1:${userId}`;

export function readGameNotices(userId: number): GameNoticeState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(noticeStorageKey(userId)) ?? "null");
    if (Array.isArray(parsed?.known) && Array.isArray(parsed?.pending)) {
      return {
        known: parsed.known.filter((key: unknown): key is string => typeof key === "string"),
        pending: parsed.pending.filter((key: unknown): key is string => typeof key === "string"),
      };
    }
  } catch {
    // Storage can be disabled or contain data from an older version.
  }
  return null;
}

export function saveGameNotices(userId: number, state: GameNoticeState): void {
  try {
    localStorage.setItem(noticeStorageKey(userId), JSON.stringify(state));
  } catch {
    // Notice persistence is optional; navigation remains available.
  }
}

export function reconcileGameNotices(previous: GameNoticeState | null, availableKeys: string[]): GameNoticeState {
  const available = new Set(availableKeys);
  if (!previous) return { known: [...available], pending: [] };

  const known = new Set(previous.known);
  const pending = new Set(previous.pending.filter(key => available.has(key)));
  for (const key of available) {
    if (!known.has(key)) pending.add(key);
    known.add(key);
  }

  return { known: [...known], pending: [...pending] };
}

export function markGameOpened(state: GameNoticeState, key: string): GameNoticeState {
  return {
    known: state.known.includes(key) ? state.known : [...state.known, key],
    pending: state.pending.filter(pendingKey => pendingKey !== key),
  };
}
