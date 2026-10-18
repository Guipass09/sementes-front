import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionMusicControls } from "../src/features/session/SessionMusicControls";
import { SessionReactionPicker } from "../src/features/session/SessionReactionPicker";
import { initialMusicState } from "../src/features/session/session-music-policy";

test("music stays in the compact reaction popover with a closed selection list", () => {
  const view = { ...initialMusicState(), notice: "", confirmed: false };
  const controls = (
    <SessionMusicControls view={view} disabled={false} onChange={() => {}} />
  );
  const markup = renderToStaticMarkup(controls);
  assert.ok(markup.includes('aria-label="Escolher música"'));
  assert.ok(markup.includes('role="combobox"'));
  assert.ok(markup.includes('aria-expanded="false"'));
  assert.ok(
    !markup.includes('role="option"'),
    "All 20 songs are not displayed at once",
  );
  assert.ok(markup.includes('aria-label="Tocar para todos"'));
  assert.ok(markup.includes('aria-label="Voltar ao início"'));
  assert.ok(markup.includes('aria-label="Repetir música"'));
  assert.ok(markup.includes('aria-label="Volume da música"'));
  assert.ok(markup.includes("/audio/session-music/CREDITS.md"));
  const trigger = renderToStaticMarkup(
    <SessionReactionPicker
      disabled={false}
      audioPending={false}
      audioSettings={{ muted: true, volume: 0.35 }}
      onAudioChange={() => {}}
      onAudioCommit={() => {}}
      onSend={async () => {}}
      musicControls={controls}
    />,
  );
  assert.ok(
    !trigger.includes("Músicas infantis"),
    "Closing the menu hides the controls without owning playback",
  );
});

test("playing state offers an immediate pause, shared confirmation and accessible loop state", () => {
  const markup = renderToStaticMarkup(
    <SessionMusicControls
      view={{
        ...initialMusicState(),
        playing: true,
        confirmed: true,
        notice: "",
      }}
      disabled={false}
      onChange={() => {}}
    />,
  );
  assert.ok(markup.includes('aria-label="Pausar para todos"'));
  assert.ok(markup.includes("Tocando para os dois"));
  assert.ok(markup.includes('aria-pressed="true"'));
});
