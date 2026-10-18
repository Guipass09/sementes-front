import * as api from "@/lib/laravel-api";
import type { GameLibrarySlug, LibraryGame } from "./game-library";

type GameLibraryAdapter = {
  list: () => Promise<LibraryGame[]>;
  remove: (id: number) => Promise<void>;
};

export function gameLibraryApi(
  slug: GameLibrarySlug,
  professional: boolean,
): GameLibraryAdapter {
  const memory = slug === "memoria" || slug === "memoria2";
  if (memory)
    return {
      list: () =>
        professional
          ? api.professionalListMemoryGames({
              variant: slug === "memoria" ? "classic" : "v2",
            })
          : api.adminListMemoryGames({
              variant: slug === "memoria" ? "classic" : "v2",
            }),
      remove: professional
        ? api.professionalDeleteMemoryGame
        : api.adminDeleteMemoryGame,
    };
  const adapters = {
    fonema: {
      list: professional
        ? api.professionalListPhonemeGames
        : api.adminListPhonemeGames,
      remove: professional
        ? api.professionalDeletePhonemeGame
        : api.adminDeletePhonemeGame,
    },
    auditivo: {
      list: professional
        ? api.professionalListAuditoryGames
        : api.adminListAuditoryGames,
      remove: professional
        ? api.professionalDeleteAuditoryGame
        : api.adminDeleteAuditoryGame,
    },
    forca: {
      list: professional
        ? api.professionalListHangmanGames
        : api.adminListHangmanGames,
      remove: professional
        ? api.professionalDeleteHangmanGame
        : api.adminDeleteHangmanGame,
    },
    roleta: {
      list: professional
        ? api.professionalListSpinWheelGames
        : api.adminListSpinWheelGames,
      remove: professional
        ? api.professionalDeleteSpinWheelGame
        : api.adminDeleteSpinWheelGame,
    },
    "caca-palavras": {
      list: professional
        ? api.professionalListWordSearchGames
        : api.adminListWordSearchGames,
      remove: professional
        ? api.professionalDeleteWordSearchGame
        : api.adminDeleteWordSearchGame,
    },
    cartas: {
      list: professional
        ? api.professionalListCardGames
        : api.adminListCardGames,
      remove: professional
        ? api.professionalDeleteCardGame
        : api.adminDeleteCardGame,
    },
    "acerte-imagem": {
      list: professional
        ? api.professionalListGuessImageGames
        : api.adminListGuessImageGames,
      remove: professional
        ? api.professionalDeleteGuessImageGame
        : api.adminDeleteGuessImageGame,
    },
  };
  const adapter =
    adapters[slug as Exclude<GameLibrarySlug, "memoria" | "memoria2">];
  return {
    list: (): Promise<LibraryGame[]> => adapter.list(),
    remove: adapter.remove,
  };
}
