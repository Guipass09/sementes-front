import { test } from "node:test";
import assert from "node:assert/strict";
import { attachRemoteTrack, recoveryNeedsNewPeer, remoteOfferHandled, remoteTrackTarget, rememberRemoteOffer, serializePeerOperation } from "../src/features/session/session-peer-recovery.ts";

test("peer descriptions run serially and an error cannot poison later recovery", async () => {
  const peer = {}; const events: string[] = [];
  const first = serializePeerOperation(peer, async () => { events.push("offer"); await new Promise(resolve => setTimeout(resolve, 5)); events.push("sent"); });
  const bad = serializePeerOperation(peer, async () => { events.push("bad"); throw new Error("bad SDP"); });
  const next = serializePeerOperation(peer, async () => { events.push("answer"); return "ok"; });
  await first; await assert.rejects(bad); assert.equal(await next, "ok");
  assert.deepEqual(events, ["offer", "sent", "bad", "answer"]);
});

test("duplicate offers are scoped to the peer and bounded", () => {
  const peer = {}; const other = {};
  rememberRemoteOffer(peer, "one"); assert.equal(remoteOfferHandled(peer, "one"), true);
  assert.equal(remoteOfferHandled(other, "one"), false);
  for (let i = 0; i < 30; i++) rememberRemoteOffer(peer, `offer-${i}`);
  assert.equal(remoteOfferHandled(peer, "one"), false);
  assert.equal(remoteOfferHandled(peer, "offer-29"), true);
});

test("closed or persistently failed transports rebuild but first attempt only restarts ICE", () => {
  assert.equal(recoveryNeedsNewPeer("disconnected", 1), false);
  assert.equal(recoveryNeedsNewPeer("failed", 2), false);
  assert.equal(recoveryNeedsNewPeer("failed", 3), true);
  assert.equal(recoveryNeedsNewPeer("closed", 1), true);
  assert.equal(recoveryNeedsNewPeer("connected", 1, true), true);
});

const transceiver = (kind: string, id: string) => ({ receiver: { track: { kind, id } } }) as RTCRtpTransceiver;

test("a replacement camera track remains camera, even with a new ID and active screen sharing", () => {
  const camera = transceiver("video", "old-camera"); const screen = transceiver("video", "screen");
  const peers = [camera, screen];
  assert.equal(remoteTrackTarget(camera, peers, null, null), "camera");
  Object.assign(camera.receiver.track, { id: "new-camera" });
  assert.equal(remoteTrackTarget(camera, peers, null, null), "camera");
  assert.equal(remoteTrackTarget(screen, peers, null, null), "screen");
  assert.equal(remoteTrackTarget(camera, peers, screen, null), "camera");
});

test("screen arriving first cannot capture the camera slot; microphone and screen audio stay separate", () => {
  const camera = transceiver("video", "camera"); const screen = transceiver("video", "screen");
  const mic = transceiver("audio", "mic"); const screenAudio = transceiver("audio", "screen-audio");
  const peers = [mic, camera, screen, screenAudio];
  assert.equal(remoteTrackTarget(screen, peers, null, null), "screen");
  assert.equal(remoteTrackTarget(camera, peers, null, null), "camera");
  assert.equal(remoteTrackTarget(mic, peers, null, null), "camera");
  assert.equal(remoteTrackTarget(screenAudio, peers, null, null), "screen");
});

test("replacing video removes stale track without stopping live microphone or screen", () => {
  const stream = () => {
    const tracks: MediaStreamTrack[] = [];
    return { getTracks: () => [...tracks], addTrack: (track: MediaStreamTrack) => tracks.push(track), removeTrack: (track: MediaStreamTrack) => { const index = tracks.indexOf(track); if (index >= 0) tracks.splice(index, 1); } } as MediaStream;
  };
  const all = stream(); const camera = stream(); const screen = stream();
  const old = { kind: "video", id: "old" } as MediaStreamTrack;
  const fresh = { kind: "video", id: "fresh" } as MediaStreamTrack;
  const mic = { kind: "audio", id: "mic" } as MediaStreamTrack;
  const display = { kind: "video", id: "display" } as MediaStreamTrack;
  attachRemoteTrack(all, camera, screen, old, "camera");
  attachRemoteTrack(all, camera, screen, mic, "camera");
  attachRemoteTrack(all, camera, screen, display, "screen");
  attachRemoteTrack(all, camera, screen, fresh, "camera");
  assert.deepEqual(camera.getTracks(), [mic, fresh]);
  assert.deepEqual(screen.getTracks(), [display]);
  assert.equal(all.getTracks().includes(old), false);
  attachRemoteTrack(all, camera, screen, fresh, "camera");
  assert.equal(all.getTracks().filter(track => track === fresh).length, 1);
});
