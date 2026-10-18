import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SessionMusicController } from "../src/features/session/session-music-controller.ts";
import {
  MUSIC_LEASE_MS,
  SESSION_MUSIC_TRACKS,
  initialMusicState,
  musicLeaseRemaining,
  parseMusicPacket,
  type MusicState,
  type MusicView,
  type MusicPacket,
} from "../src/features/session/session-music-policy.ts";
import type { MusicPlayer } from "../src/features/session/session-music-player.ts";

class PlayerFake implements MusicPlayer {
  playing = false;
  pos = 0;
  until = 0;
  blocked = false;
  pauses = 0;
  disposed = false;
  now: () => number;
  constructor(now: () => number) {
    this.now = now;
  }
  async apply(state: MusicState, lease: number) {
    this.pos = state.position;
    this.playing = state.playing && !this.blocked;
    this.until = this.now() + lease;
    return this.playing;
  }
  position() {
    return this.pos;
  }
  pause() {
    this.playing = false;
    this.pauses++;
  }
  unlock() {}
  dispose() {
    this.pause();
    this.disposed = true;
  }
}
type Wire = {
  target: "admin" | "user";
  kind: string;
  from: string;
  payload: unknown;
};
function pair() {
  let now = 0;
  let adminView: MusicView;
  let userView: MusicView;
  const adminPlayer = new PlayerFake(() => now);
  const userPlayer = new PlayerFake(() => now);
  const wire: Wire[] = [];
  let failAdmin = false;
  let failUser = false;
  const admin = new SessionMusicController({
    role: "admin",
    serverNow: 100000,
    now: () => now,
    id: "staff-controller",
    player: adminPlayer,
    send: async (kind, payload) => {
      if (failAdmin) throw new Error("Offline");
      wire.push({ target: "user", from: "admin", kind, payload });
    },
    onView: (view) => {
      adminView = view;
    },
  });
  const user = new SessionMusicController({
    role: "user",
    serverNow: 100000,
    now: () => now,
    id: "patient",
    player: userPlayer,
    send: async (kind, payload) => {
      if (failUser) throw new Error("Offline");
      wire.push({ target: "admin", from: "user", kind, payload });
    },
    onView: (view) => {
      userView = view;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      while (wire.length) {
        const message = wire.shift()!;
        (message.target === "user" ? user : admin).receive(message);
      }
    }
  };
  return {
    admin,
    user,
    adminPlayer,
    userPlayer,
    wire,
    flush,
    setTime(value: number) {
      now = value;
    },
    failAdmin(value = true) {
      failAdmin = value;
    },
    failUser(value = true) {
      failUser = value;
    },
    adminView: () => adminView!,
    userView: () => userView!,
    dispose() {
      admin.dispose();
      user.dispose();
    },
  };
}

test("20 distinct local tracks have valid files, hashes and attribution", () => {
  assert.equal(SESSION_MUSIC_TRACKS.length, 20);
  assert.equal(new Set(SESSION_MUSIC_TRACKS.map((track) => track.id)).size, 20);
  const credits = readFileSync(
    new URL("../public/audio/session-music/CREDITS.md", import.meta.url),
    "utf8",
  );
  let size = 0;
  for (const track of SESSION_MUSIC_TRACKS) {
    const data = readFileSync(
      new URL(`../public${track.url}`, import.meta.url),
    );
    size += data.length;
    assert.equal(createHash("sha256").update(data).digest("hex"), track.sha256);
    assert.ok(
      data.subarray(0, 3).toString() === "ID3" ||
        (data[0] === 255 && (data[1] & 224) === 224),
    );
    assert.ok(
      credits.includes(track.title) &&
        credits.includes(track.author) &&
        credits.includes(track.sha256),
    );
    assert.ok(track.duration > 20 && track.duration < 600);
  }
  assert.ok(
    size < 45_000_000,
    "Catalog should use compact audio and fetch only the selected track",
  );
});

test("both start paused, play together, confirm patient audio and pause synchronously on receipt", async () => {
  const s = pair();
  assert.equal(s.adminView().playing, false);
  assert.equal(s.userView().playing, false);
  s.admin.change({ playing: true });
  await s.flush();
  assert.ok(s.adminPlayer.playing && s.userPlayer.playing);
  assert.equal(s.adminView().confirmed, true);
  s.admin.change({ playing: false });
  assert.equal(
    s.adminPlayer.playing,
    false,
    "Local pause is immediate before HTTP completes",
  );
  await s.flush();
  assert.equal(s.userPlayer.playing, false);
  s.dispose();
});

test("a delayed play or heartbeat cannot undo a newer pause", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  const oldPlay = s.wire[0];
  await s.flush();
  s.admin.change({ playing: false });
  await s.flush();
  s.user.receive(oldPlay);
  assert.equal(s.userPlayer.playing, false);
  assert.equal(s.userView().playing, false);
  s.dispose();
});

test("failed play commands stop local audio and stale successful confirmations cannot revive the paused revision", async () => {
  const s = pair();
  s.failAdmin();
  s.admin.change({ playing: true });
  await s.flush();
  assert.equal(s.adminPlayer.playing, false);
  assert.equal(s.userPlayer.playing, false);
  s.admin.receive({
    kind: "session_music_ack",
    from: "user",
    payload: {
      v: 1,
      controllerId: "staff-controller",
      revision: 1,
      sequence: 1,
      issuedAt: 100000,
      playing: true,
    },
  });
  assert.equal(s.adminView().confirmed, false);
  assert.equal(s.adminView().playing, false);
  s.dispose();
});

test("rapid select/play/pause commands delivered in reverse order converge to the latest paused state", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  s.admin.change({
    trackId: SESSION_MUSIC_TRACKS[1].id,
    position: 0,
    playing: false,
  });
  s.admin.change({ playing: true });
  s.admin.change({ playing: false });
  s.wire.reverse();
  await s.flush();
  assert.equal(s.userView().trackId, SESSION_MUSIC_TRACKS[1].id);
  assert.equal(s.userView().playing, false);
  assert.equal(s.userPlayer.playing, false);
  s.dispose();
});

test("returning to a frozen patient tab cannot silently resume an expired revision", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  await s.flush();
  s.setTime(6000);
  s.user.receive({
    kind: "session_music",
    from: "admin",
    payload: {
      ...initialMusicState(),
      v: 1,
      controllerId: "staff-controller",
      controllerAt: 100000,
      playing: true,
      revision: 1,
      sequence: 2,
      issuedAt: 106000,
    },
  });
  await s.flush();
  assert.equal(s.userPlayer.playing, false);
  assert.equal(s.adminPlayer.playing, false);
  s.dispose();
});

test("a completely lost pause stops patient audio by lease expiry and old renewal cannot resume it", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  await s.flush();
  s.failAdmin();
  s.admin.change({ playing: false });
  await s.flush();
  s.setTime(MUSIC_LEASE_MS + 1);
  s.user.tick();
  assert.equal(s.userPlayer.playing, false);
  s.failAdmin(false);
  s.user.receive({
    kind: "session_music",
    from: "admin",
    payload: {
      ...initialMusicState(),
      v: 1,
      controllerId: "staff-controller",
      controllerAt: 100000,
      playing: true,
      revision: 1,
      sequence: 2,
      issuedAt: 105001,
    },
  });
  assert.equal(
    s.userPlayer.playing,
    false,
    "Expired revision stays blocked until explicit new play",
  );
  await s.flush();
  s.admin.change({ playing: true });
  await s.flush();
  assert.equal(s.userPlayer.playing, true);
  s.dispose();
});

test("play packets delayed beyond their lease never start even when server queue delivery is fresh", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  s.setTime(7000);
  await s.flush();
  assert.equal(s.userPlayer.playing, false);
  assert.equal(s.adminPlayer.playing, false);
  s.dispose();
});

test("blocked patient autoplay or missing audio acknowledgement pauses both instead of leaving staff thinking it works", async () => {
  const blocked = pair();
  blocked.userPlayer.blocked = true;
  blocked.admin.change({ playing: true });
  await blocked.flush();
  assert.equal(blocked.adminView().playing, false);
  assert.equal(blocked.userView().playing, false);
  blocked.dispose();
  const lost = pair();
  lost.admin.change({ playing: true });
  for (let t = 1400; t <= 7000; t += 1400) {
    lost.setTime(t);
    lost.admin.tick();
    await Promise.resolve();
  }
  assert.equal(lost.adminPlayer.playing, false);
  lost.dispose();
});

test("poll/offline failures, closing either side and a failed command stop without automatic recovery playback", async () => {
  for (const side of ["admin", "user"] as const) {
    const s = pair();
    s.admin.change({ playing: true });
    await s.flush();
    s[side].safetyPause("Offline");
    await s.flush();
    assert.equal(s.adminView().playing, false);
    assert.equal(s.userView().playing, false);
    s.dispose();
  }
  const s = pair();
  s.admin.change({ playing: true });
  await s.flush();
  s.user.dispose();
  await s.flush();
  assert.equal(s.adminPlayer.playing, false);
  s.admin.dispose();
});

test("heartbeats maintain a 40-minute session without rewinding; seek, loop, track changes and volume are shared", async () => {
  const s = pair();
  s.admin.change({ playing: true });
  await s.flush();
  for (let t = 1400; t < 40 * 60000; t += 1400) {
    s.setTime(t);
    s.adminPlayer.pos = (t / 1000) % SESSION_MUSIC_TRACKS[0].duration;
    s.admin.tick();
    s.user.tick();
    await s.flush();
    assert.ok(
      s.adminPlayer.playing && s.userPlayer.playing,
      `Both sides remain controlled at ${t}`,
    );
    assert.equal(s.userView().position, s.adminPlayer.pos);
  }
  s.admin.change({ position: 0, loop: false, volume: 0.12 });
  await s.flush();
  assert.equal(s.userView().position, 0);
  assert.equal(s.userView().loop, false);
  assert.equal(s.userView().volume, 0.12);
  s.admin.change({
    trackId: SESSION_MUSIC_TRACKS[1].id,
    playing: false,
    position: 0,
  });
  await s.flush();
  assert.equal(s.userView().trackId, SESSION_MUSIC_TRACKS[1].id);
  assert.equal(s.userPlayer.playing, false);
  s.dispose();
});

test("patient commands, malformed payloads, future clocks and older controller instances cannot start music", () => {
  const s = pair();
  const packet: MusicPacket = {
    ...initialMusicState(),
    playing: true,
    v: 1,
    controllerId: "owner",
    controllerAt: 100000,
    revision: 1,
    sequence: 1,
    issuedAt: 100000,
  };
  s.user.receive({ kind: "session_music", from: "user", payload: packet });
  assert.equal(s.userView().playing, false);
  for (const patch of [
    { trackId: "https://evil.test/audio.mp3" },
    { volume: Infinity },
    { position: NaN },
    { revision: -1 },
    { sequence: "5" },
    { loop: 1 },
  ])
    assert.equal(parseMusicPacket({ ...packet, ...patch }), null);
  assert.equal(musicLeaseRemaining(9000, 1000), 0);
  s.user.receive({
    kind: "session_music",
    from: "admin",
    payload: { ...packet, controllerAt: 900000 },
  });
  assert.equal(s.userView().playing, false);
  s.user.receive({
    kind: "session_music",
    from: "admin",
    payload: { ...packet, playing: false },
  });
  s.user.receive({
    kind: "session_music",
    from: "admin",
    payload: {
      ...packet,
      controllerId: "old-owner",
      controllerAt: 99999,
      sequence: 20,
    },
  });
  assert.equal(s.userView().playing, false);
  s.dispose();
});
