import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";
import {
  GameLibraryCard,
  GAME_LIBRARY_GRID,
} from "../src/features/games/GameLibraryCard";
import {
  GAME_LIBRARIES,
  gamePlayPath,
  type GameLibrarySlug,
} from "../src/features/games/game-library";

test("every game category renders the same large cover with separate play and management controls", () => {
  for (const slug of Object.keys(GAME_LIBRARIES) as GameLibrarySlug[]) {
    const html = renderToStaticMarkup(
      <StaticRouter location="/profissional/jogos">
        <GameLibraryCard
          title="Jogo de teste"
          subtitle="4 rodadas"
          kind={GAME_LIBRARIES[slug].kind}
          imageUrl="/cover.jpg"
          playPath={gamePlayPath(slug, 42)}
          editPath={`/profissional/jogos/${slug}/42/editar`}
          onSend={() => {}}
          onShare={() => {}}
          onDelete={() => {}}
        />
      </StaticRouter>,
    );
    assert.ok(html.includes("aspect-[16/10]"));
    assert.ok(html.includes("object-contain"));
    assert.ok(html.includes(`href="${gamePlayPath(slug, 42)}"`));
    assert.ok(html.includes('aria-label="Jogar Jogo de teste"'));
    assert.ok(html.includes('aria-label="Editar Jogo de teste"'));
    assert.ok(html.includes('aria-label="Compartilhar Jogo de teste"'));
    assert.ok(html.includes('aria-label="Excluir Jogo de teste"'));
    assert.ok(html.includes('src="/cover.jpg"'));
  }
  assert.ok(GAME_LIBRARY_GRID.includes("sm:grid-cols-2"));
  assert.ok(GAME_LIBRARY_GRID.includes("lg:grid-cols-3"));
});

test("shared cards do not render author-only buttons and draft stories are not playable", () => {
  const html = renderToStaticMarkup(
    <StaticRouter>
      <GameLibraryCard
        title="Compartilhado"
        kind="memory_game"
        playPath="/jogos/1"
      />
    </StaticRouter>,
  );
  assert.equal(html.includes('aria-label="Excluir'), false);
  assert.equal(html.includes('aria-label="Editar'), false);
  const draft = renderToStaticMarkup(
    <StaticRouter>
      <GameLibraryCard
        title="Rascunho"
        kind="activity"
        playPath="/atividades/1"
        playable={false}
      />
    </StaticRouter>,
  );
  assert.equal(draft.includes('href="/atividades/1"'), false);
  assert.ok(draft.includes('disabled=""'));
});
