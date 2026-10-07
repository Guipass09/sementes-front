import type { ActivityRow, StoryGameType } from "@/lib/laravel-api";

export function storyGamePath(type: StoryGameType, id: number): string {
  const prefix: Record<StoryGameType, string> = {
    memory_game: "/jogos/",
    memory_game_v2: "/jogos/memoria2/",
    phoneme_game: "/jogos/fonema/",
    auditory_game: "/jogos/auditivo/",
    hangman_game: "/jogos/forca/",
    spin_wheel_game: "/jogos/roleta/",
    word_search_game: "/jogos/caca-palavras/",
    card_game: "/jogos/cartas/",
    guess_image_game: "/jogos/acerte-imagem/",
  };
  return `${prefix[type]}${id}`;
}

export function storyStepPath(story: ActivityRow, index: number): string | null {
  const step = story.story_steps?.[index];
  if (!step) return null;
  return step.type === "media"
    ? `/atividades/${story.id}?story_step=${index}`
    : storyGamePath(step.game_type, step.game_id);
}
