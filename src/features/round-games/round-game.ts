import type { GameRound, RoundGameKind } from "../../lib/laravel-api.ts";

export const roundGameInfo = {
  sound: { title: "Sons e imagens", slug: "sons-imagens", type: "sound_image_game", description: "Encontre as figuras que combinam com o som de cada rodada." },
  sequence: { title: "Sequência de imagens", slug: "sequencia-imagens", type: "image_sequence_game", description: "Organize as figuras para construir uma história, passo a passo." },
} as const;

export type RoundState = { round: number; selected: string[]; mistake: string | null; completed: boolean; celebration: boolean; attempt: number };
export type RoundAction = { kind: "choose"; round: number; choice: string } | { kind: "next"; round: number } | { kind: "retry"; round: number } | { kind: "restart" } | { kind: "congrats_close" };
export const initialRoundState = (): RoundState => ({ round: 0, selected: [], mistake: null, completed: false, celebration: false, attempt: 0 });

export function roundSolved(round: GameRound, kind: RoundGameKind, selected: string[]): boolean {
  const expected = round.choices.filter(c => kind === "sequence" || c.correct).map(c => c.id);
  return expected.length > 0 && expected.length === selected.length && (kind === "sequence"
    ? expected.every((id, i) => selected[i] === id) : expected.every(id => selected.includes(id)));
}

// The same pure reducer handles local clicks and the live session's replayed events.
export function reduceRoundGame(state: RoundState, action: RoundAction, rounds: GameRound[], kind: RoundGameKind): RoundState {
  if (action.kind === "restart") return { ...initialRoundState(), attempt: state.attempt + 1 };
  if (action.kind === "congrats_close") return { ...state, celebration: false };
  if (state.completed || action.round !== state.round) return state;
  const round = rounds[state.round];
  if (!round) return state;
  if (action.kind === "retry") return { ...state, selected: [], mistake: null };
  if (action.kind === "next") {
    if (!roundSolved(round, kind, state.selected)) return state;
    return { ...state, round: Math.min(state.round + 1, rounds.length - 1), selected: [], mistake: null,
      completed: state.round === rounds.length - 1, celebration: state.round === rounds.length - 1 };
  }
  const choice = round.choices.find(c => c.id === action.choice);
  if (!choice || state.selected.includes(choice.id) || roundSolved(round, kind, state.selected)) return state;
  const correct = kind === "sound" ? choice.correct : round.choices[state.selected.length]?.id === choice.id;
  return correct ? { ...state, selected: [...state.selected, choice.id], mistake: null } : { ...state, mistake: choice.id };
}

export function shuffledChoices(round: GameRound, seed: number): GameRound['choices'] {
  const choices = [...round.choices];
  let value = seed >>> 0;
  for (let i = choices.length - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  if (choices.length > 1 && choices.every((c, i) => c.id === round.choices[i].id)) choices.push(choices.shift()!);
  return choices;
}

export function validateRounds(rounds: GameRound[], kind: RoundGameKind): string | null {
  if (!rounds.length) return "Adicione pelo menos uma rodada.";
  for (const [i, round] of rounds.entries()) {
    const prefix = `Rodada ${i + 1}: `;
    if (!round.prompt.trim()) return prefix + "preencha a pergunta.";
    if (round.choices.length < 2) return prefix + "adicione pelo menos duas figuras.";
    if (round.choices.some(c => !c.path)) return prefix + "aguarde o envio das imagens.";
    if (kind === "sound" && !round.choices.some(c => c.correct)) return prefix + "marque pelo menos uma figura correta.";
  }
  return null;
}
