import assert from "node:assert/strict";
import test from "node:test";
import { storyGamePath, storyStepPath } from "../src/features/stories/story-sequence.ts";
import type { ActivityRow, StoryGameType } from "../src/lib/laravel-api.ts";

test("story steps preserve a mixed sequence and a repeated game", () => {
  const story = {
    id: 42,
    story_steps: [
      { type: "media", media_id: 11 },
      { type: "game", game_type: "memory_game", game_id: 5 },
      { type: "media", media_id: 12 },
      { type: "game", game_type: "memory_game", game_id: 5 },
    ],
  } as ActivityRow;

  assert.deepEqual(story.story_steps?.map((_, index) => storyStepPath(story, index)), [
    "/atividades/42?story_step=0",
    "/jogos/5",
    "/atividades/42?story_step=2",
    "/jogos/5",
  ]);
  assert.equal(storyStepPath(story, 4), null);
});

test("all game types use their existing game routes", () => {
  const routes: Record<StoryGameType, string> = {
    memory_game: "/jogos/7",
    memory_game_v2: "/jogos/memoria2/7",
    phoneme_game: "/jogos/fonema/7",
    auditory_game: "/jogos/auditivo/7",
    hangman_game: "/jogos/forca/7",
    spin_wheel_game: "/jogos/roleta/7",
    word_search_game: "/jogos/caca-palavras/7",
    card_game: "/jogos/cartas/7",
    guess_image_game: "/jogos/acerte-imagem/7",
  };
  for (const [type, path] of Object.entries(routes)) {
    assert.equal(storyGamePath(type as StoryGameType, 7), path);
  }
});
