import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionReactionOverlay } from "../src/features/session/SessionReactionOverlay";
import {
  SessionReactionPicker,
  reactionOptions,
} from "../src/features/session/SessionReactionPicker";
import { createSessionReaction } from "../src/features/session/session-reactions";

test("overlay uses safe text, one announcement and bounded decorative copies", () => {
  const markup = renderToStaticMarkup(
    <SessionReactionOverlay
      reaction={createSessionReaction("message", "<img onerror=alert(1)>")}
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
    renderToStaticMarkup(<SessionReactionOverlay reaction={null} />),
    "",
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
