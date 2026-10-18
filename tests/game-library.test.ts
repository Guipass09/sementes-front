import assert from "node:assert/strict";
import test from "node:test";
import {
  GAME_LIBRARIES,
  filterLibraryGames,
  gameLibraryCount,
  gameLibraryPermissions,
  gamePlayPath,
  type GameLibrarySlug,
  type LibraryGame,
} from "../src/features/games/game-library.ts";

const game: LibraryGame = {
  id: 7,
  title: "Memória de animais",
  description: "Atenção aos pares",
  created_by: { id: 2, name: "Fono" },
  assigned_to: [],
};

test("all nine legacy categories have distinct correct playable routes", () => {
  assert.equal(Object.keys(GAME_LIBRARIES).length, 9);
  assert.equal(gamePlayPath("memoria", 7), "/jogos/7");
  assert.equal(gamePlayPath("memoria2", 7), "/jogos/memoria2/7");
  for (const slug of Object.keys(GAME_LIBRARIES) as GameLibrarySlug[]) {
    if (slug !== "memoria")
      assert.equal(gamePlayPath(slug, 7), `/jogos/${slug}/7`);
  }
  assert.equal(GAME_LIBRARIES.memoria2.shareType, "memory_game");
  assert.equal(GAME_LIBRARIES.memoria2.kind, "memory_game_v2");
});

test("search and patient filtering include private games without duplicating assigned games", () => {
  const assigned = {
    ...game,
    id: 8,
    assigned_to: [
      { id: 10, name: "Paciente" },
      { id: 11, name: "Outro" },
    ],
  };
  const rows = [game, assigned, assigned];
  assert.equal(filterLibraryGames(rows, "memoria").length, 2);
  assert.equal(filterLibraryGames(rows, "ATENCAO").length, 2);
  assert.deepEqual(
    filterLibraryGames(rows, "", "unassigned").map((item) => item.id),
    [7],
  );
  assert.deepEqual(
    filterLibraryGames(rows, "", "10").map((item) => item.id),
    [8],
  );
  assert.equal(filterLibraryGames(rows, "unknown").length, 0);
});

test("library actions never grant management of shared-only games", () => {
  for (const slug of Object.keys(GAME_LIBRARIES) as GameLibrarySlug[]) {
    assert.deepEqual(
      gameLibraryPermissions(slug, game, { id: 2, role: "professional" }),
      { edit: true, delete: true, assign: true, share: true },
    );
    assert.deepEqual(
      gameLibraryPermissions(slug, game, { id: 3, role: "professional" }),
      { edit: false, delete: false, assign: false, share: false },
    );
    assert.equal(
      gameLibraryPermissions(slug, game, { id: 3, role: "admin" }).assign,
      true,
    );
  }
  const assigned = { ...game, assigned_to: [{ id: 10, name: "Paciente" }] };
  assert.equal(
    gameLibraryPermissions("memoria", assigned, { id: 3, role: "professional" })
      .edit,
    true,
  );
  assert.equal(
    gameLibraryPermissions("auditivo", assigned, {
      id: 3,
      role: "professional",
    }).edit,
    false,
  );
});

test("card subtitles preserve counts for every game format", () => {
  assert.equal(gameLibraryCount({ ...game, pairs_count: 5 }), "5 pares");
  assert.equal(gameLibraryCount({ ...game, cards_count: 10 }), "10 cartas");
  assert.equal(gameLibraryCount({ ...game, words_count: 3 }), "3 palavras");
  assert.equal(gameLibraryCount({ ...game, sessions_count: 4 }), "4 rodadas");
  assert.equal(gameLibraryCount({ ...game, items_count: 2 }), "2 imagens");
});
