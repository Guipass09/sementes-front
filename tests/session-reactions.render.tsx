import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionReactionOverlay } from "../src/features/session/SessionReactionOverlay";
import {
  SessionReactionPicker,
  reactionOptions,
} from "../src/features/session/SessionReactionPicker";
import {
  MAX_ACTIVE_REACTIONS,
  createSessionReaction,
} from "../src/features/session/session-reactions";

test("overlay uses safe text, one announcement and bounded decorative copies", () => {
  const markup = renderToStaticMarkup(
    <SessionReactionOverlay
      reactions={[createSessionReaction("message", "<img onerror=alert(1)>")]}
      onFinished={() => {}}
    />,
  );
  assert.ok(!markup.includes("<img"));
  assert.ok(markup.includes("&lt;img"));
  assert.equal(
    (markup.match(/class="session-reaction-particle"/g) || []).length,
    9,
  );
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert.ok(markup.includes('aria-hidden="true"'));
  assert.equal(
    renderToStaticMarkup(
      <SessionReactionOverlay reactions={[]} onFinished={() => {}} />,
    ),
    "",
  );
});

test("multiple reaction types coexist while the overlay caps DOM cost and announces only the latest", () => {
  const reactions = [
    createSessionReaction("confetti"),
    createSessionReaction("hearts"),
    createSessionReaction("happy"),
  ];
  const markup = renderToStaticMarkup(
    <SessionReactionOverlay reactions={reactions} onFinished={() => {}} />,
  );
  for (const reaction of reactions)
    assert.ok(markup.includes(`data-reaction="${reaction.type}"`));
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  const many = Array.from({ length: 40 }, () =>
    createSessionReaction("confetti"),
  );
  const capped = renderToStaticMarkup(
    <SessionReactionOverlay reactions={many} onFinished={() => {}} />,
  );
  assert.equal(
    (capped.match(/data-reaction="confetti"/g) || []).length,
    MAX_ACTIVE_REACTIONS,
  );
  assert.equal(
    (capped.match(/class="session-reaction-particle"/g) || []).length,
    MAX_ACTIVE_REACTIONS * 80,
  );
});

test("picker keeps the same toolbar trigger and provides four presets plus custom messages", () => {
  assert.deepEqual(
    reactionOptions.map((option) => option.type),
    ["confetti", "applause", "hearts", "happy"],
  );
  const markup = renderToStaticMarkup(
    <SessionReactionPicker
      disabled={false}
      audioPending={false}
      audioSettings={{ muted: true, volume: 0.35 }}
      onAudioChange={() => {}}
      onAudioCommit={() => {}}
      onSend={async () => {}}
    />,
  );
  assert.ok(markup.includes("Reações"));
  assert.ok(markup.includes('aria-haspopup="dialog"'));
  assert.ok(markup.includes('aria-expanded="false"'));
});
