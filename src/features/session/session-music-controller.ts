import {
  MUSIC_ACK_TIMEOUT_MS,
  MUSIC_HEARTBEAT_MS,
  MUSIC_LEASE_MS,
  initialMusicState,
  musicLeaseRemaining,
  musicPosition,
  parseMusicAck,
  parseMusicPacket,
  type MusicAck,
  type MusicPacket,
  type MusicState,
  type MusicView,
} from "./session-music-policy.ts";
import type { MusicPlayer } from "./session-music-player.ts";

type Message = { kind: string; from: string; payload?: unknown; at?: string };
type Options = {
  role: "admin" | "user";
  serverNow: number;
  now: () => number;
  id: string;
  player: MusicPlayer;
  send: (kind: string, payload: unknown) => Promise<void>;
  onView: (view: MusicView) => void;
};

export class SessionMusicController {
  private state = initialMusicState();
  private revision = 0;
  private sequence = 0;
  private disposed = false;
  private notice = "";
  private confirmed = false;
  private started: number;
  private nextHeartbeat = 0;
  private lastAck = 0;
  private ackSequence = -1;
  private remote: MusicPacket | null = null;
  private blockedRevision = -1;
  private leaseUntil = 0;
  private inFlight = false;
  private pauseRetries = 0;
  private application = 0;
  private options: Options;

  constructor(options: Options) {
    this.options = options;
    this.started = options.now();
    this.publish();
  }
  private serverTime() {
    return Math.floor(
      this.options.serverNow + this.options.now() - this.started,
    );
  }
  private publish() {
    if (!this.disposed)
      this.options.onView({
        ...this.state,
        notice: this.notice,
        confirmed: this.confirmed,
      });
  }
  isPlaying() {
    return this.state.playing;
  }
  unlock() {
    this.options.player.unlock();
  }
  private packet(): MusicPacket {
    return {
      ...this.state,
      v: 1,
      controllerId: this.options.id,
      controllerAt: this.options.serverNow,
      revision: this.revision,
      sequence: ++this.sequence,
      issuedAt: this.serverTime(),
      position: this.state.playing
        ? this.options.player.position()
        : this.state.position,
    };
  }
  private async broadcast() {
    const packet = this.packet();
    try {
      await this.options.send("session_music", packet);
    } catch {
      if (
        !this.disposed &&
        this.revision === packet.revision &&
        this.state.playing
      )
        this.safetyPause(
          "A música foi pausada. Confira a conexão e toque novamente.",
        );
    }
  }

  private async applyLocal(
    leaseMs: number,
    revision: number,
    remoteSequence?: number,
    forceSeek = false,
  ) {
    const application = ++this.application;
    const playing = await this.options.player.apply(
      this.state,
      leaseMs,
      forceSeek,
    );
    if (
      this.disposed ||
      !this.state.playing ||
      application !== this.application
    )
      return;
    if (this.options.role === "admin") {
      if (revision !== this.revision) return;
      if (!playing)
        this.safetyPause(
          "Não foi possível tocar a música. Toque novamente para tentar.",
        );
    } else if (
      this.remote?.revision === revision &&
      this.remote.sequence === remoteSequence
    ) {
      if (!playing)
        this.safetyPause("A música foi pausada para manter os dois juntos.");
      else this.ack(true);
    }
  }

  change(patch: Partial<MusicState>) {
    if (this.disposed || this.options.role !== "admin") return;
    const proposed = {
      ...this.state,
      position: this.state.playing
        ? this.options.player.position()
        : this.state.position,
      ...patch,
    };
    const checked = parseMusicPacket({
      ...proposed,
      v: 1,
      controllerId: this.options.id,
      controllerAt: this.options.serverNow,
      revision: 0,
      sequence: 0,
      issuedAt: this.serverTime(),
    });
    if (!checked) return;
    const wasPlaying = this.state.playing;
    this.state = {
      trackId: checked.trackId,
      playing: checked.playing && checked.volume > 0,
      position: checked.position,
      loop: checked.loop,
      volume: checked.volume,
    };
    this.revision++;
    this.ackSequence = -1;
    this.confirmed = false;
    this.notice = "";
    if (!this.state.playing) {
      this.options.player.pause();
      this.pauseRetries = 3;
    } else {
      if (!wasPlaying) this.lastAck = this.options.now();
      this.leaseUntil = this.options.now() + MUSIC_LEASE_MS;
      void this.applyLocal(MUSIC_LEASE_MS, this.revision, undefined, true);
    }
    this.nextHeartbeat = this.options.now() + MUSIC_HEARTBEAT_MS;
    this.publish();
    void this.broadcast();
  }

  private ack(playing: boolean) {
    if (!this.remote) return;
    const payload: MusicAck = {
      v: 1,
      controllerId: this.remote.controllerId,
      revision: this.remote.revision,
      sequence: this.remote.sequence,
      issuedAt: this.serverTime(),
      playing,
    };
    void this.options.send("session_music_ack", payload).catch(() => {
      if (playing && !this.disposed && this.state.playing)
        this.safetyPause("A música foi pausada. Confira a conexão.");
    });
  }

  receive(message: Message) {
    if (this.disposed) return;
    if (this.state.playing && this.options.now() >= this.leaseUntil)
      this.safetyPause("A música foi pausada por segurança.");
    if (this.options.role === "admin") {
      if (message.kind !== "session_music_ack" || message.from !== "user")
        return;
      const ack = parseMusicAck(message.payload);
      if (
        !ack ||
        ack.controllerId !== this.options.id ||
        ack.revision !== this.revision ||
        ack.sequence < this.ackSequence ||
        ack.sequence > this.sequence ||
        !musicLeaseRemaining(ack.issuedAt, this.serverTime())
      )
        return;
      this.ackSequence = ack.sequence;
      if (!ack.playing && this.state.playing) {
        this.safetyPause(
          "A música foi pausada nos dois lados. Confira o áudio do paciente e toque novamente.",
        );
      } else if (ack.playing && this.state.playing) {
        this.lastAck = this.options.now();
        this.confirmed = true;
        this.publish();
      }
      return;
    }
    if (message.kind !== "session_music" || message.from !== "admin") return;
    const packet = parseMusicPacket(message.payload);
    if (
      !packet ||
      packet.issuedAt < this.options.serverNow ||
      packet.controllerAt > this.serverTime() + 1000
    )
      return;
    const old = this.remote;
    if (old) {
      if (old.controllerId !== packet.controllerId) {
        if (packet.controllerAt <= old.controllerAt) return;
        this.blockedRevision = -1;
      } else if (
        packet.revision < old.revision ||
        packet.sequence <= old.sequence
      )
        return;
    }
    this.remote = packet;
    const remaining = musicLeaseRemaining(packet.issuedAt, this.serverTime());
    if (
      packet.playing &&
      (packet.revision <= this.blockedRevision || !remaining)
    ) {
      this.blockedRevision = Math.max(this.blockedRevision, packet.revision);
      this.options.player.pause();
      this.state = { ...packet, playing: false };
      this.ack(false);
      this.publish();
      return;
    }
    this.state = {
      trackId: packet.trackId,
      playing: packet.playing && packet.volume > 0,
      position: musicPosition(
        packet,
        Math.max(0, this.serverTime() - packet.issuedAt) / 1000,
      ),
      loop: packet.loop,
      volume: packet.volume,
    };
    this.notice = "";
    if (!this.state.playing) {
      this.options.player.pause();
      this.ack(false);
    } else {
      this.leaseUntil = this.options.now() + remaining;
      void this.applyLocal(
        remaining,
        packet.revision,
        packet.sequence,
        !old ||
          old.controllerId !== packet.controllerId ||
          old.revision !== packet.revision,
      );
    }
    this.publish();
  }

  tick() {
    if (this.disposed) return;
    const now = this.options.now();
    if (this.state.playing && now >= this.leaseUntil) {
      this.safetyPause(
        "A música foi pausada por segurança. Toque novamente para continuar.",
      );
      return;
    }
    if (this.options.role !== "admin") return;
    if (this.state.playing && now - this.lastAck > MUSIC_ACK_TIMEOUT_MS) {
      this.safetyPause(
        "A música foi pausada nos dois lados enquanto a conexão se recupera.",
      );
      return;
    }
    if (now < this.nextHeartbeat || this.inFlight) return;
    this.nextHeartbeat = now + MUSIC_HEARTBEAT_MS;
    if (this.state.playing) {
      this.state = { ...this.state, position: this.options.player.position() };
      this.leaseUntil = now + MUSIC_LEASE_MS;
      void this.applyLocal(MUSIC_LEASE_MS, this.revision);
    } else if (this.pauseRetries > 0) this.pauseRetries--;
    else return;
    this.inFlight = true;
    void this.broadcast().finally(() => {
      this.inFlight = false;
    });
  }

  safetyPause(notice = "") {
    if (this.disposed) return;
    const wasPlaying = this.state.playing;
    const position = wasPlaying
      ? this.options.player.position()
      : this.state.position;
    this.options.player.pause();
    this.application++;
    this.state = { ...this.state, playing: false, position };
    this.confirmed = false;
    this.notice = notice;
    if (this.options.role === "admin" && wasPlaying) {
      this.revision++;
      this.pauseRetries = 3;
      void this.broadcast();
    } else if (this.options.role === "user" && this.remote && wasPlaying) {
      this.blockedRevision = Math.max(
        this.blockedRevision,
        this.remote.revision,
      );
      this.ack(false);
    }
    this.publish();
  }

  ended() {
    this.safetyPause();
  }
  dispose() {
    if (this.disposed) return;
    this.safetyPause();
    this.disposed = true;
    this.options.player.dispose();
  }
}
