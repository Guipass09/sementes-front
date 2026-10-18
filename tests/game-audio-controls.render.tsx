import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GameAudioButton,
  GameAudioControls,
} from "../src/features/games/GameAudio";
import type { ReactElement } from "react";

test("audio button exposes its action and mute state with stable icon dimensions", () => {
  const muted = renderToStaticMarkup(
    <GameAudioButton muted onClick={() => {}} />,
  );
  assert.match(muted, /aria-label="Ativar sons dos jogos"/);
  assert.match(muted, /title="Ativar sons dos jogos"/);
  assert.match(muted, /aria-pressed="true"/);
  assert.match(muted, /h-10 w-10/);
  assert.match(muted, /lucide-volume-x/);
  const enabled = renderToStaticMarkup(
    <GameAudioButton muted={false} onClick={() => {}} disabled />,
  );
  assert.match(enabled, /aria-label="Silenciar sons dos jogos"/);
  assert.match(enabled, /aria-pressed="false"/);
  assert.match(enabled, /disabled=""/);
  assert.match(enabled, /lucide-volume2/);
});

test("volume controls expose a keyboard-accessible percentage slider", () => {
  const html = renderToStaticMarkup(
    <GameAudioControls
      settings={{ muted: false, volume: 0.08 }}
      onChange={() => {}}
    />,
  );
  assert.match(html, /type="range"/);
  assert.match(html, /aria-label="Volume dos jogos"/);
  assert.match(html, /min="0" max="100" step="1"/);
  assert.match(html, /aria-valuetext="8%"/);
  assert.match(html, /value="8"/);
  assert.match(html, />8%<\/output>/);
});

test("drag previews levels immediately, commits on release, and zero can be unmuted", () => {
  const changes: Array<{ muted: boolean; volume: number }> = [];
  const commits: Array<{ muted: boolean; volume: number }> = [];
  const element = GameAudioControls({
    settings: { muted: false, volume: 0 },
    onChange: (value) => changes.push(value),
    onCommit: (value) => commits.push(value),
  });
  const children = element.props.children as ReactElement[];
  children[1].props.onChange({ currentTarget: { value: "9" } });
  assert.deepEqual(changes[0], { muted: false, volume: 0.09 });
  assert.equal(commits.length, 0);
  children[1].props.onPointerUp({ currentTarget: { value: "9" } });
  assert.deepEqual(commits[0], { muted: false, volume: 0.09 });
  children[0].props.onClick();
  assert.deepEqual(changes[1], { muted: false, volume: 0.35 });
  assert.deepEqual(commits[1], changes[1]);
});
