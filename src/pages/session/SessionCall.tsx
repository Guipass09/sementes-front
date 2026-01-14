import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as api from "@/lib/laravel-api";
import type { ActivityRow, MemoryGameRow, AuditoryGameRow, HangmanGameRow, SpinWheelGameRow } from "@/lib/laravel-api";
import { isApiError, videoJoin, videoPoll, videoSendCommand, type VideoJoinResponse, type VideoPollMessage } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";

type Role = "admin" | "user";

function safeStopStream(s: MediaStream | null) {
  if (!s) return;
  for (const t of s.getTracks()) {
    try {
      t.stop();
    } catch {}
  }
}

export default function SessionCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const appointmentId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [joining, setJoining] = useState(true);
  const [joinInfo, setJoinInfo] = useState<VideoJoinResponse | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const pendingWebrtcRef = useRef<VideoPollMessage[]>([]);
  const peerReadyRef = useRef(false);
  const ensurePeerRef = useRef<Promise<void> | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string>("Conectando...");
  const [contentPath, setContentPath] = useState<string | null>(null);
  const [controlGranted, setControlGranted] = useState<boolean>(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [memGames, setMemGames] = useState<MemoryGameRow[]>([]);
  const [audGames, setAudGames] = useState<AuditoryGameRow[]>([]);
  const [hangGames, setHangGames] = useState<HangmanGameRow[]>([]);
  const [spinGames, setSpinGames] = useState<SpinWheelGameRow[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const joiningRef = useRef(false);

  const goBack = (r: Role | null) => {
    if (r === "admin") navigate("/admin/horarios");
    else navigate("/paciente/sessoes");
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/entrar");
  }, [authLoading, user, navigate]);

  // Join room (backend), then set up WebRTC lazily
  useEffect(() => {
    if (!user) return;
    if (!appointmentId) return;
    if (joiningRef.current) return;
    joiningRef.current = true;

    let cancelled = false;
    (async () => {
      setJoining(true);
      setStatusLabel("Entrando na sessão...");
      try {
        const res = await videoJoin(appointmentId);
        if (cancelled) return;
        setJoinInfo(res);
        setRole(res.role);
        const initialPath = res.room?.content?.path || null;
        setContentPath(typeof initialPath === "string" && initialPath ? initialPath : null);
        setControlGranted(!!res.room?.control_granted_to_user);
        setStatusLabel("Preparando câmera e microfone...");
      } catch (e) {
        if (cancelled) return;
        const msg =
          isApiError(e) && e.status === 403
            ? "Essa sessão ainda não está disponível. Tente mais perto do horário."
            : "Não foi possível entrar na sessão.";
        toast({ title: "Sessão", description: msg, variant: "destructive" });
        setJoinInfo(null);
        setRole(null);
        setJoining(false);
        // volta para lista
        goBack((user?.role as any) === "admin" ? "admin" : "user");
      } finally {
        if (!cancelled) setJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, user]);

  // Attach streams to video elements
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    if (localStream) {
      el.srcObject = localStream;
      // Safari/iOS: pode exigir play() explícito mesmo com autoPlay
      void el.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (remoteStream) {
      el.srcObject = remoteStream;
      void el.play().catch(() => {});
    }
  }, [remoteStream]);

  const send = async (kind: string, payload?: any) => {
    if (!joinInfo) return;
    await videoSendCommand({
      appointment_id: joinInfo.sessionId,
      token: joinInfo.token,
      kind,
      payload,
    });
  };

  const selectContent = async (path: string) => {
    if (!path) return;
    setContentPath(path);
    try {
      await send("content_select", { path });
    } catch {
      // se falhar, mantém estado local (admin ainda vê)
    }
    setCatalogOpen(false);
  };

  const toggleControl = async () => {
    if (role !== "admin") return;
    const next = !controlGranted;
    setControlGranted(next);
    try {
      await send("control_set", { granted: next });
    } catch {
      // se falhar, reverte
      setControlGranted(!next);
    }
  };

  const flushPendingWebrtc = async () => {
    if (!peerReadyRef.current) return;
    const batch = pendingWebrtcRef.current.splice(0);
    for (const m of batch) {
      await handleMessage(m);
    }
  };

  const ensurePeer = async () => {
    if (!joinInfo) return;
    if (peerReadyRef.current) return;
    if (ensurePeerRef.current) return await ensurePeerRef.current;

    ensurePeerRef.current = (async () => {
      if (pcRef.current) {
        // pode existir mas ainda não estar "ready"
      } else {
        const pc = new RTCPeerConnection({ iceServers: joinInfo.iceServers || [] });
        pcRef.current = pc;

        const inbound = new MediaStream();
        setRemoteStream(inbound);

        pc.ontrack = (ev) => {
          try {
            // preferir track direto (mais robusto)
            inbound.addTrack(ev.track);
          } catch {}
          // Em alguns browsers, é mais confiável usar o stream completo
          const s0 = ev.streams?.[0];
          if (s0 && remoteVideoRef.current && remoteVideoRef.current.srcObject !== s0) {
            remoteVideoRef.current.srcObject = s0;
            void remoteVideoRef.current.play().catch(() => {});
          }
        };

        pc.onicecandidate = (ev) => {
          if (!ev.candidate) return;
          void send("webrtc_ice", { candidate: ev.candidate });
        };

        pc.onconnectionstatechange = () => {
          setStatusLabel(pc.connectionState === "connected" ? "Conectado" : "Conectando...");
        };

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);

        for (const track of stream.getTracks()) {
          pcRef.current?.addTrack(track, stream);
        }
      }

      peerReadyRef.current = true;
      await flushPendingWebrtc();
    })()
      .finally(() => {
        ensurePeerRef.current = null;
      });

    return await ensurePeerRef.current;
  };

  const handleMessage = async (m: VideoPollMessage) => {
    // WebRTC (sdp/ice) precisa esperar o peer/local tracks estarem prontos
    if (
      (m.kind === "webrtc_offer" ||
        m.kind === "webrtc_answer" ||
        m.kind === "webrtc_ice") &&
      !peerReadyRef.current
    ) {
      pendingWebrtcRef.current.push(m);
      return;
    }

    const pc = pcRef.current;

    if (m.kind === "webrtc_offer" && role === "user") {
      if (!pc) return;
      const sdp = m.payload?.sdp;
      if (!sdp) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send("webrtc_answer", { sdp: pc.localDescription });
    }

    if (m.kind === "webrtc_answer" && role === "admin") {
      if (!pc) return;
      const sdp = m.payload?.sdp;
      if (!sdp) return;
      if (pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }

    if (m.kind === "webrtc_ice") {
      if (!pc) return;
      const c = m.payload?.candidate;
      if (!c) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore (race during renegotiation)
      }
    }

    if (m.kind === "call_end") {
      cleanup();
      goBack(role);
    }

    if (m.kind === "content_select") {
      const p = m.payload?.path;
      if (typeof p === "string" && p) {
        setContentPath(p);
      }
    }

    if (m.kind === "control_set") {
      const granted = !!m.payload?.granted;
      setControlGranted(granted);
    }
  };

  // Start peer + admin offer
  useEffect(() => {
    if (!joinInfo || !role) return;
    let cancelled = false;
    (async () => {
      try {
        await ensurePeer();
        if (cancelled) return;

        // Admin inicia (determinístico)
        if (role === "admin") {
          const pc = pcRef.current;
          if (!pc) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await send("webrtc_offer", { sdp: pc.localDescription });
        }
      } catch (e) {
        if (cancelled) return;
        toast({ title: "WebRTC", description: "Falha ao iniciar câmera/microfone.", variant: "destructive" });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinInfo?.token, role]);

  // Poll commands
  useEffect(() => {
    if (!joinInfo || !role) return;
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (cancelled) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await videoPoll({
          appointment_id: joinInfo.sessionId,
          token: joinInfo.token,
          after_id: cursorRef.current,
        });
        if (cancelled) return;
        if (Array.isArray(res.messages) && res.messages.length) {
          for (const m of res.messages) {
            // Garante que mensagens WebRTC não se percam por "peer ainda não pronto"
            if (
              (m.kind === "webrtc_offer" ||
                m.kind === "webrtc_answer" ||
                m.kind === "webrtc_ice") &&
              !peerReadyRef.current
            ) {
              pendingWebrtcRef.current.push(m);
              continue;
            }
            await handleMessage(m);
          }
        }
        const next = Number.isFinite(res.next_cursor as any) ? (res.next_cursor as any as number) : cursorRef.current;
        cursorRef.current = next;
        setCursor(next);
      } catch {
        // silencioso: rede intermitente
      } finally {
        inFlight = false;
      }
    };

    const id = window.setInterval(() => void tick(), 800);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinInfo?.token, role]);

  const cleanup = () => {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    peerReadyRef.current = false;
    pendingWebrtcRef.current = [];
    safeStopStream(localStream);
    safeStopStream(remoteStream);
    setLocalStream(null);
    setRemoteStream(null);
  };

  useEffect(() => {
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    if (!localStream) return;
    const tracks = localStream.getAudioTracks();
    for (const t of tracks) t.enabled = !t.enabled;
    setMicOn(tracks.every((t) => t.enabled));
  };

  const toggleCam = () => {
    if (!localStream) return;
    const tracks = localStream.getVideoTracks();
    for (const t of tracks) t.enabled = !t.enabled;
    setCamOn(tracks.every((t) => t.enabled));
  };

  const hangup = async () => {
    try {
      await send("call_end", {});
    } catch {}
    cleanup();
    goBack(role);
  };

  // Carregar catálogo apenas quando admin abrir (lazy)
  useEffect(() => {
    if (!catalogOpen) return;
    if (role !== "admin") return;
    if (catalogLoading) return;
    if (activities.length || memGames.length || audGames.length || hangGames.length || spinGames.length) return;

    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const [a, mem, aud, hang, spin] = await Promise.all([
          api.adminListActivities().catch(() => [] as ActivityRow[]),
          api.adminListMemoryGames().catch(() => [] as MemoryGameRow[]),
          api.adminListAuditoryGames().catch(() => [] as AuditoryGameRow[]),
          api.adminListHangmanGames().catch(() => [] as HangmanGameRow[]),
          api.adminListSpinWheelGames().catch(() => [] as SpinWheelGameRow[]),
        ]);
        if (cancelled) return;
        setActivities(a);
        setMemGames(mem);
        setAudGames(aud);
        setHangGames(hang);
        setSpinGames(spin);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogOpen, role]);

  if (authLoading || joining) {
    return <FullScreenLogoLoader label={statusLabel} />;
  }

  const iframeSrc = contentPath ? (contentPath.startsWith("http") ? contentPath : contentPath) : null;

  return (
    <div className="min-h-[100svh] bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Sementes da Fala" className="h-8 w-8 rounded-lg object-cover" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Sessão ao vivo</div>
              <div className="text-xs text-muted-foreground">{statusLabel}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">ID {appointmentId}</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Área principal (conteúdo da sessão) */}
          <div className="rounded-2xl border border-border bg-card p-4 min-h-[60vh] flex items-center justify-center">
            {iframeSrc ? (
              <div className="relative w-full h-[60vh] lg:h-[70vh]">
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  className="absolute inset-0 h-full w-full rounded-xl bg-background"
                  title="Conteúdo da sessão"
                />
                {role === "user" && !controlGranted && (
                  <div
                    className="absolute inset-0 rounded-xl bg-background/40 backdrop-blur-[1px] flex items-center justify-center"
                    style={{ pointerEvents: "auto" }}
                  >
                    <div className="text-center max-w-sm px-4">
                      <div className="text-lg font-semibold text-foreground mb-1">Aguarde o controle</div>
                      <div className="text-sm text-muted-foreground">
                        Você poderá interagir quando a fonoaudióloga liberar.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : role === "user" ? (
              <div className="text-center max-w-md">
                <img src={logoImage} alt="Sementes da Fala" className="h-16 w-16 mx-auto mb-4 rounded-2xl object-cover" />
                <div className="text-2xl font-display font-bold text-foreground mb-2">Boa sessão 🌱</div>
                <div className="text-sm text-muted-foreground">
                  Aguarde a fonoaudióloga selecionar a atividade.
                </div>
              </div>
            ) : (
              <div className="text-center max-w-md">
                <div className="text-xl font-semibold text-foreground mb-2">Selecione uma atividade/jogo</div>
                <div className="text-sm text-muted-foreground">
                  Abra uma atividade/jogo e ele aparecerá aqui e para o paciente instantaneamente.
                </div>
                <div className="mt-4">
                  <Button onClick={() => setCatalogOpen(true)} className="rounded-xl">
                    Abrir catálogo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Coluna de câmeras */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-foreground border-b border-border">
                {role === "admin" ? "Paciente" : "Fonoaudióloga"}
              </div>
              <div className="relative aspect-[4/3] bg-black">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-foreground border-b border-border">
                {role === "admin" ? "Você (admin)" : "Você"}
              </div>
              <div className="relative aspect-[4/3] bg-black">
                <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </div>

        {/* Controles */}
        {role === "admin" && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setCatalogOpen(true)} className="rounded-xl">
              Catálogo
            </Button>
            <Button variant="outline" onClick={() => void toggleControl()} className="rounded-xl">
              {controlGranted ? "Retirar controle do paciente" : "Dar controle ao paciente"}
            </Button>
            <Button
              variant="outline"
              onClick={toggleMic}
              className={cn("rounded-xl", !micOn ? "border-destructive text-destructive" : "")}
            >
              {micOn ? <Mic /> : <MicOff />}
            </Button>
            <Button
              variant="outline"
              onClick={toggleCam}
              className={cn("rounded-xl", !camOn ? "border-destructive text-destructive" : "")}
            >
              {camOn ? <Video /> : <VideoOff />}
            </Button>
            <Button variant="destructive" onClick={() => void hangup()} className="rounded-xl">
              <PhoneOff />
            </Button>
          </div>
        )}
      </div>

      {/* Catálogo (admin) */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catálogo da sessão</DialogTitle>
          </DialogHeader>

          {catalogLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-8">
              <div>
                <div className="text-sm font-semibold text-foreground mb-3">Atividades</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activities.map((a) => (
                    <button
                      key={`act-${a.id}`}
                      onClick={() => void selectContent(`/atividades/${a.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{a.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{a.category || "Atividade"}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-foreground mb-3">Jogos</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {memGames.map((g) => (
                    <button
                      key={`mem-${g.id}`}
                      onClick={() => void selectContent(`/jogos/${g.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Jogo da Memória</div>
                    </button>
                  ))}
                  {audGames.map((g) => (
                    <button
                      key={`aud-${g.id}`}
                      onClick={() => void selectContent(`/jogos/auditivo/${g.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Estimulação Auditiva</div>
                    </button>
                  ))}
                  {hangGames.map((g) => (
                    <button
                      key={`hang-${g.id}`}
                      onClick={() => void selectContent(`/jogos/forca/${g.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Jogo da Forca</div>
                    </button>
                  ))}
                  {spinGames.map((g) => (
                    <button
                      key={`spin-${g.id}`}
                      onClick={() => void selectContent(`/jogos/roleta/${g.id}`)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Roleta</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-foreground mb-3">Pacotes (links)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { sessions: 3, url: "https://mpago.li/2nyHQAi" },
                    { sessions: 6, url: "https://mpago.li/1j7Xk5U" },
                    { sessions: 9, url: "https://mpago.li/2Fof5SU" },
                    { sessions: 15, url: "https://mpago.li/32tdG89" },
                    { sessions: 20, url: "https://mpago.li/1as3z5h" },
                    { sessions: 35, url: "https://mpago.la/143JtGF" },
                    { sessions: 45, url: "https://mpago.la/31AJ9th" },
                  ].map((p) => (
                    <button
                      key={`pkg-${p.sessions}`}
                      onClick={() => void selectContent(p.url)}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground">{p.sessions} sessões</div>
                      <div className="text-xs text-muted-foreground">Abrir link no paciente</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Observação: alguns links externos podem bloquear uso em iframe (regra do provedor).
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

