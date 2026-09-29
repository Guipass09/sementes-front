export type GameNoticeState = {
  known: string[];
  pending: string[];
};

export const gameNoticeKey = (categoryId: string, gameId: number) => `${categoryId}:${gameId}`;

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
