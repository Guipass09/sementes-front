import type { ActivityRow, StoryGameType, StoryStep } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { gameCatalogImage } from "@/features/session/SessionCatalogTile";

export type StoryGameChoice = {
  type: StoryGameType;
  id: number;
  title: string;
  category: string;
  imageUrl?: string | null;
};

export const storyGameLabels: Record<StoryGameType, string> = {
  memory_game: "Memória",
  memory_game_v2: "Memória 2.0",
  phoneme_game: "Discriminação de fonemas",
  auditory_game: "Estimulação auditiva",
  hangman_game: "Forca",
  spin_wheel_game: "Roleta",
  word_search_game: "Caça-palavras",
  card_game: "Cartas",
  guess_image_game: "Acerte a imagem",
};

export function storyStepLabel(step: StoryStep, story: ActivityRow, games: StoryGameChoice[]): string {
  if (step.type === "media") {
    const media = story.media.find((item) => item.id === step.media_id);
    return media?.caption || (media?.media_type === "video" ? "Vídeo" : "Imagem");
  }
  return games.find((item) => item.type === step.game_type && item.id === step.game_id)?.title
    || `${storyGameLabels[step.game_type]} #${step.game_id}`;
}

export async function loadStoryGames(role: "admin" | "professional"): Promise<StoryGameChoice[]> {
  const isAdmin = role === "admin";
  const loaders: Array<[StoryGameType, () => Promise<any[]>]> = [
    ["memory_game", () => isAdmin ? api.adminListMemoryGames({ variant: "classic" }) : api.professionalListMemoryGames({ variant: "classic" })],
    ["memory_game_v2", () => isAdmin ? api.adminListMemoryGames({ variant: "v2" }) : api.professionalListMemoryGames({ variant: "v2" })],
    ["phoneme_game", () => isAdmin ? api.adminListPhonemeGames() : api.professionalListPhonemeGames()],
    ["auditory_game", () => isAdmin ? api.adminListAuditoryGames() : api.professionalListAuditoryGames()],
    ["hangman_game", () => isAdmin ? api.adminListHangmanGames() : api.professionalListHangmanGames()],
    ["spin_wheel_game", () => isAdmin ? api.adminListSpinWheelGames() : api.professionalListSpinWheelGames()],
    ["word_search_game", () => isAdmin ? api.adminListWordSearchGames() : api.professionalListWordSearchGames()],
    ["card_game", () => isAdmin ? api.adminListCardGames() : api.professionalListCardGames()],
    ["guess_image_game", () => isAdmin ? api.adminListGuessImageGames() : api.professionalListGuessImageGames()],
  ];
  const results = await Promise.all(loaders.map(async ([type, load]) => {
    try {
      const rows = await load();
      return rows.map((game: any): StoryGameChoice => ({
        type, id: game.id, title: game.title,
        category: storyGameLabels[type],
        imageUrl: gameCatalogImage(game),
      }));
    } catch {
      return [];
    }
  }));
  return results.flat();
}
