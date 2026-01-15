import type { PointerEvent as ReactPointerEvent } from "react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FileText,
  Mic,
  MicOff,
  MonitorUp,
  Package,
  Pencil,
  PhoneOff,
  Timer,
  Trash2,
  Video,
  VideoOff,
} from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import * as api from "@/lib/laravel-api";
import type { ActivityRow, MemoryGameRow, AuditoryGameRow, HangmanGameRow, SpinWheelGameRow } from "@/lib/laravel-api";
import { isApiError, videoJoin, videoPoll, videoSendCommand, type VideoJoinResponse, type VideoPollMessage } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";

const ReportFormModalLazy = lazy(async () => {
  const mod = await import("@/features/reports/ReportFormModal");
  return { default: mod.ReportFormModal };
});

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
  const [epoch, setEpoch] = useState<string | null>(null);
  const epochRef = useRef<string | null>(null);
  const pendingWebrtcRef = useRef<VideoPollMessage[]>([]);
  const pendingIceRef = useRef<any[]>([]);
  const pendingOfferRef = useRef<any | null>(null);
  const peerReadyRef = useRef(false);
  const ensurePeerRef = useRef<Promise<void> | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string>("Conectando...");
  const [mediaState, setMediaState] = useState<"idle" | "requesting" | "ready" | "failed">("idle");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [contentPath, setContentPath] = useState<string | null>(null);
  const [contentTitle, setContentTitle] = useState<string | null>(null);
  const [contentKind, setContentKind] = useState<string | null>(null);
  const [contentSeed, setContentSeed] = useState<number | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [controlGranted, setControlGranted] = useState<boolean>(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [memGames, setMemGames] = useState<MemoryGameRow[]>([]);
  const [audGames, setAudGames] = useState<AuditoryGameRow[]>([]);
  const [hangGames, setHangGames] = useState<HangmanGameRow[]>([]);
  const [spinGames, setSpinGames] = useState<SpinWheelGameRow[]>([]);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<null | { path: string; title: string; kind: string }>(null);
  const [pendingPayment, setPendingPayment] = useState<null | { sessions: number; url: string }>(null);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentSessions, setPaymentSessions] = useState<number | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [fixedUser, setFixedUser] = useState<null | { id: number; name: string }>(null);

  const [callStartedAtMs, setCallStartedAtMs] = useState<number | null>(null);
  const [callElapsedLabel, setCallElapsedLabel] = useState<string>("00:00");

  const [drawOn, setDrawOn] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawActiveRef = useRef(false);
  const drawLastRef = useRef<{ x: number; y: number } | null>(null);
  const drawRemoteLastRef = useRef<Record<string, { x: number; y: number } | null>>({});
  const drawSendTsRef = useRef(0);

  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localVafRef = useRef<number | null>(null);
  const remoteVafRef = useRef<number | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const contentScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastContentRef = useRef<{ path: string | null; title: string | null; kind: string | null; seed: number | null } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const contentFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const joiningRef = useRef(false);

  const goBack = (r: Role | null) => {
    if (r === "admin") navigate("/admin/horarios");
    else navigate("/paciente/sessoes");
  };

  const packageCatalog = useMemo(() => {
    // Mesmo catálogo do PatientPackages (valores fixos do negócio)
    const list = [
      { sessions: 3, price: 280, url: "https://mpago.li/2nyHQAi" },
      { sessions: 6, price: 480, url: "https://mpago.li/1j7Xk5U" },
      { sessions: 9, price: 560, url: "https://mpago.li/2Fof5SU" },
      { sessions: 15, price: 880, url: "https://mpago.li/32tdG89" },
      { sessions: 20, price: 1100, url: "https://mpago.li/1as3z5h" },
      { sessions: 35, price: 1750, url: "https://mpago.la/143JtGF" },
      { sessions: 45, price: 2115, url: "https://mpago.la/31AJ9th" },
    ];
    const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return list.map((p) => ({ ...p, priceLabel: fmt(p.price), perSessionLabel: fmt(p.price / p.sessions) }));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/entrar");
  }, [authLoading, user, navigate]);

  // Quando screen share estiver ativo:
  // - admin mostra o próprio display stream no painel grande
  // - user mostra o remoteStream (que passa a ser a tela do admin)
  useEffect(() => {
    if (!screenShareActive) return;
    const el = contentScreenVideoRef.current;
    if (!el) return;
    const stream = role === "admin" ? screenStreamRef.current : remoteStream;
    if (!stream) return;
    el.srcObject = stream;
    el.muted = true; // áudio continua controlado pelo vídeo remoto na lateral
    void el.play().catch(() => {});
  }, [screenShareActive, role, remoteStream]);

  // Temporizador simples da chamada (não depende do relógio do servidor)
  useEffect(() => {
    if (!callStartedAtMs) return;
    const id = window.setInterval(() => {
      const sec = Math.max(0, Math.floor((Date.now() - callStartedAtMs) / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, "0");
      const ss = String(sec % 60).padStart(2, "0");
      setCallElapsedLabel(`${mm}:${ss}`);
    }, 1000);
    return () => window.clearInterval(id);
  }, [callStartedAtMs]);

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
        setCallStartedAtMs(Date.now());
        // NÃO pular mensagens pendentes (ex.: offer enviado antes do paciente entrar).
        // A filtragem de mensagens antigas é feita via epoch.
        cursorRef.current = 0;
        setCursor(0);
        const e = typeof (res as any)?.epoch === "string" ? ((res as any).epoch as string) : null;
        epochRef.current = e;
        setEpoch(e);
        const initialPath = res.room?.content?.path || null;
        setContentPath(typeof initialPath === "string" && initialPath ? initialPath : null);
        setContentTitle(null);
        setContentKind((res as any)?.room?.content?.kind ?? null);
        setContentSeed(
          typeof (res as any)?.room?.content?.seed === "number" ? (res as any).room.content.seed : null
        );
        setContentLoading(false);
        setControlGranted(!!res.room?.control_granted_to_user);
        setScreenShareActive(!!(res as any)?.room?.screen_share_active);
        setStatusLabel("Toque em “Iniciar câmera e microfone”");
        setMediaState("idle");
        setMediaError(null);
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

  const clearDoodleLocal = () => {
    try {
      const c = drawCanvasRef.current;
      const ctx = drawCtxRef.current;
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    } catch {}
    drawLastRef.current = null;
    drawRemoteLastRef.current = {};
  };

  const computeSeed = (path: string) => {
    // Seed simples e estável para sincronizar embaralhamento (ex.: memória) entre admin e usuário.
    // Não precisa ser criptográfico, só determinístico.
    const base = `${joinInfo?.sessionId ?? 0}:${path}`;
    let h = 2166136261;
    for (let i = 0; i < base.length; i++) {
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 1_000_000_000;
  };

  const normalizeSdpInit = (raw: any): RTCSessionDescriptionInit | null => {
    if (!raw || typeof raw !== "object") return null;
    const type = String((raw as any).type || "");
    const sdpRaw = (raw as any).sdp;
    if (type !== "offer" && type !== "answer") return null;
    if (typeof sdpRaw !== "string" || !sdpRaw.trim()) return null;
    // iOS/Safari é mais sensível: garantir CRLF e remover linhas vazias
    const sdp =
      sdpRaw
        .replace(/\r?\n/g, "\r\n")
        .split("\r\n")
        .filter((l) => l.trim() !== "")
        .join("\r\n") + "\r\n";
    return { type: type as any, sdp };
  };

  const selectContent = async (path: string, title: string, kind: string) => {
    if (!path) return;
    // Ao trocar conteúdo, limpa rabiscos (efeito "compartilhamento de tela" por atividade)
    clearDoodleLocal();
    void send("draw_event", { t: "clear" }).catch(() => {});
    setContentPath(path);
    setContentTitle(title || null);
    setContentKind(kind || null);
    // Seed sempre que for conteúdo interno (evita "ordem diferente" entre admin/paciente)
    const seed = path.startsWith("http") ? null : computeSeed(path);
    setContentSeed(seed);
    setContentLoading(true);
    try {
      await send("content_select", { path, title, kind, seed });
    } catch {
      // se falhar, mantém estado local (admin ainda vê)
    }
    setCatalogOpen(false);
  };

  const sendPayment = async (sessions: number, url: string) => {
    if (role !== "admin") return;
    await send("payment_link", { sessions, url });
  };

  // Carrega dados mínimos do paciente para pré-preencher relatório (admin)
  useEffect(() => {
    if (role !== "admin") return;
    if (!joinInfo?.token) return;
    if (!appointmentId) return;
    if (fixedUser) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.adminListAppointments();
        if (cancelled) return;
        const appt = list.find((a) => a.id === appointmentId);
        const u = appt?.user;
        if (u?.id && u?.name) setFixedUser({ id: u.id, name: u.name });
      } catch {
        // ok: admin ainda consegue escolher manualmente dentro do modal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, joinInfo?.token, appointmentId, fixedUser]);

  const toggleControl = async () => {
    if (role !== "admin") return;
    const next = !controlGranted;
    setControlGranted(next);
    try {
      contentFrameRef.current?.contentWindow?.postMessage(
        { type: "SESSION_CONTROL", granted: next },
        window.location.origin
      );
    } catch {}
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

  const flushPendingIce = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (!pc.remoteDescription) return;
    const batch = pendingIceRef.current.splice(0);
    for (const c of batch) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore
      }
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
          setStatusLabel(
            pc.connectionState === "connected"
              ? "Conectado"
              : pc.connectionState === "connecting"
              ? "Conectando..."
              : pc.connectionState === "failed"
              ? "Falha na conexão"
              : "Conectando..."
          );
        };

        pc.oniceconnectionstatechange = () => {
          // Ajuda a diagnosticar se falta TURN/NAT (ex.: "failed")
          if (pc.iceConnectionState === "failed") {
            setStatusLabel("Falha ICE (rede restrita)");
          }
        };

        // Não chamamos getUserMedia automaticamente:
        // iOS/Safari (PWA) costuma exigir gesto do usuário.
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
    // Ignora mensagens antigas/de outra "versão" da chamada.
    // (resolve "fila suja" sem perder mensagens pendentes quando o outro entra depois)
    const myEpoch = epochRef.current;
    const msgEpoch = (m as any)?.epoch;
    if (myEpoch) {
      if (typeof msgEpoch !== "string" || msgEpoch !== myEpoch) return;
    }

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
      const sdp = normalizeSdpInit(m.payload?.sdp);
      if (!sdp) return;
      // Guardar o offer até o usuário iniciar câmera/microfone (garante 2-way)
      if (mediaState !== "ready") {
        pendingOfferRef.current = sdp;
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send("webrtc_answer", { sdp: { type: pc.localDescription?.type, sdp: pc.localDescription?.sdp } });
    }

    if (m.kind === "webrtc_answer" && role === "admin") {
      if (!pc) return;
      const sdp = normalizeSdpInit(m.payload?.sdp);
      if (!sdp) return;
      if (pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingIce();
    }

    if (m.kind === "webrtc_ice") {
      if (!pc) return;
      const c = m.payload?.candidate;
      if (!c) return;
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(c);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore (race during renegotiation)
      }
    }

    // "call_end" não deve derrubar o outro participante.
    // A sessão só "fecha" quando o admin marcar o horário como realizada (status completed).
    if (m.kind === "call_end") {
      setStatusLabel("O outro participante saiu. Você pode entrar novamente quando quiser.");
      return;
    }

    if (m.kind === "content_select") {
      const p = m.payload?.path;
      if (typeof p === "string" && p) {
        clearDoodleLocal();
        setContentPath(p);
        const t = m.payload?.title;
        setContentTitle(typeof t === "string" && t ? t : null);
        const k = m.payload?.kind;
        setContentKind(typeof k === "string" && k ? k : null);
        const s = m.payload?.seed;
        setContentSeed(typeof s === "number" ? s : null);
        setContentLoading(true);
      }
    }

    if (m.kind === "control_set") {
      const granted = !!m.payload?.granted;
      setControlGranted(granted);
      try {
        contentFrameRef.current?.contentWindow?.postMessage(
          { type: "SESSION_CONTROL", granted },
          window.location.origin
        );
      } catch {}
    }

    if (m.kind === "screen_share") {
      const active = !!m.payload?.active;
      setScreenShareActive(active);
      return;
    }

    if (m.kind === "payment_link" && role === "user") {
      const url = m.payload?.url;
      const sessions = m.payload?.sessions;
      if (typeof url === "string" && url.startsWith("http")) {
        setPaymentUrl(url);
        setPaymentSessions(Number.isFinite(Number(sessions)) ? Number(sessions) : null);
        setPaymentDialogOpen(true);
      }
    }

    if (m.kind === "draw_event") {
      const p = m.payload || {};
      const type = String(p.t || "");
      const nx = Number(p.x);
      const ny = Number(p.y);
      const from = String((m as any).from || "other");
      const ctx = drawCtxRef.current;
      const canvas = drawCanvasRef.current;
      const box = contentAreaRef.current;
      if (!ctx || !canvas || !box) return;
      const rect = box.getBoundingClientRect();
      const x = Number.isFinite(nx) ? nx * rect.width : 0;
      const y = Number.isFinite(ny) ? ny * rect.height : 0;
      const key = from;

      if (type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawRemoteLastRef.current = {};
        return;
      }

      if (type === "begin") {
        drawRemoteLastRef.current[key] = { x, y };
        return;
      }

      if (type === "move") {
        const last = drawRemoteLastRef.current[key];
        if (!last) return;
        const dpr = window.devicePixelRatio || 1;
        const color = typeof p.color === "string" ? p.color : "#22c55e";
        const w = Number.isFinite(Number(p.w)) ? Number(p.w) : 3;
        ctx.strokeStyle = color;
        ctx.lineWidth = w * dpr;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(last.x * dpr, last.y * dpr);
        ctx.lineTo(x * dpr, y * dpr);
        ctx.stroke();
        drawRemoteLastRef.current[key] = { x, y };
        return;
      }

      if (type === "end") {
        drawRemoteLastRef.current[key] = null;
        return;
      }
    }

    if (m.kind === "game_event") {
      const evt = m.payload?.event;
      if (!evt) return;
      try {
        contentFrameRef.current?.contentWindow?.postMessage(
          { type: "SESSION_GAME_EVENT", event: evt },
          window.location.origin
        );
      } catch {
        // ignore
      }
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
      } catch (e) {
        if (cancelled) return;
        console.error("[WebRTC] erro ao preparar peer", e);
        toast({ title: "WebRTC", description: "Falha ao preparar conexão.", variant: "destructive" });
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
    let delayMs = 600; // rápido no começo para handshake
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
          // Se teve mensagem, mantém poll rápido
          delayMs = 600;
        } else {
          // Sem mensagens: reduz spam de rede
          delayMs = Math.min(2500, delayMs + 250);
        }
        const next = Number.isFinite(res.next_cursor as any) ? (res.next_cursor as any as number) : cursorRef.current;
        cursorRef.current = next;
        setCursor(next);
      } catch {
        // silencioso: rede intermitente
        delayMs = Math.min(3500, delayMs + 500);
      } finally {
        inFlight = false;
      }
    };

    const loop = async () => {
      while (!cancelled) {
        await tick();
        await new Promise((r) => window.setTimeout(r, delayMs));
      }
    };
    void loop();
    return () => {
      cancelled = true;
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
    pendingIceRef.current = [];
    pendingOfferRef.current = null;
    setRemoteMuted(true);
    safeStopStream(localStream);
    safeStopStream(remoteStream);
    setLocalStream(null);
    setRemoteStream(null);
    setMediaState("idle");
    setMediaError(null);
    setDrawOn(false);
    setLocalSpeaking(false);
    setRemoteSpeaking(false);
    setScreenSharing(false);
    setScreenShareActive(false);
    try {
      if (screenStreamRef.current) safeStopStream(screenStreamRef.current);
      screenStreamRef.current = null;
    } catch {}
    try {
      const c = drawCanvasRef.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    } catch {}
  };

  // Bridge: recebe eventos do jogo (iframe) e envia para o outro participante
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data: any = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "SESSION_GAME_EVENT") return;
      if (!contentPath) return;
      // Admin sempre envia; user só envia quando controle está liberado
      if (role === "user" && !controlGranted) return;
      void send("game_event", { path: contentPath, event: data.event });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [contentPath, role, controlGranted, joinInfo?.token]);

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

  const startScreenShare = async () => {
    if (role !== "admin") return;
    if (mediaState !== "ready") {
      toast({ title: "Compartilhar tela", description: "Inicie câmera/microfone antes.", variant: "destructive" });
      return;
    }
    try {
      const display = await (navigator.mediaDevices as any).getDisplayMedia?.({ video: true, audio: false });
      if (!display) throw new Error("getDisplayMedia não disponível");
      const track: MediaStreamTrack | undefined = display.getVideoTracks?.()?.[0];
      if (!track) throw new Error("Sem vídeo da tela");
      screenStreamRef.current = display as MediaStream;
      setScreenSharing(true);
      setScreenShareActive(true);
      void send("screen_share", { active: true }).catch(() => {});

      // mostra a tela no painel de atividades (área grande), sem mexer no vídeo da câmera do admin
      const el = contentScreenVideoRef.current;
      if (el) {
        el.srcObject = display;
        el.muted = true;
        void el.play().catch(() => {});
      }

      // Troca o track enviado no WebRTC (remote passa a ver a tela)
      const pc = pcRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
      }

      track.onended = () => {
        void stopScreenShare();
      };
    } catch (e: any) {
      console.error("[ScreenShare] falhou", e);
      toast({ title: "Compartilhar tela", description: "Não foi possível compartilhar a tela.", variant: "destructive" });
      setScreenSharing(false);
      try {
        if (screenStreamRef.current) safeStopStream(screenStreamRef.current);
      } catch {}
      screenStreamRef.current = null;
    }
  };

  const stopScreenShare = async () => {
    if (role !== "admin") return;
    setScreenSharing(false);
    setScreenShareActive(false);
    void send("screen_share", { active: false }).catch(() => {});
    try {
      if (screenStreamRef.current) safeStopStream(screenStreamRef.current);
    } catch {}
    screenStreamRef.current = null;

    // limpa vídeo do painel de atividades
    const el = contentScreenVideoRef.current;
    if (el) {
      el.srcObject = null;
    }

    // volta track enviado para câmera
    const pc = pcRef.current;
    const camTrack = localStream?.getVideoTracks?.()?.[0];
    if (pc && camTrack) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(camTrack);
    }
  };

  const hangup = async () => {
    cleanup();
    goBack(role);
  };

  // Doodle (rabisco) sobre a área de conteúdo (não interrompe a ligação)
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    const box = contentAreaRef.current;
    if (!canvas || !box) return;

    const ensure = () => {
      const rect = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawCtxRef.current = ctx;
        // não limpar aqui (senão apaga rabisco ao redimensionar)
      }
    };

    ensure();
    const ro = new ResizeObserver(() => ensure());
    ro.observe(box);
    window.addEventListener("resize", ensure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", ensure);
    };
  }, [contentPath, role]);

  const sendDraw = async (payload: any) => {
    await send("draw_event", payload);
  };

  const clearDoodle = async () => {
    const canvas = drawCanvasRef.current;
    const ctx = drawCtxRef.current;
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawLastRef.current = null;
    drawRemoteLastRef.current = {};
    try {
      await sendDraw({ t: "clear" });
    } catch {}
  };

  const onDrawPointerDown = async (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawOn) return;
    const box = contentAreaRef.current;
    const canvas = drawCanvasRef.current;
    const ctx = drawCtxRef.current;
    if (!box || !canvas || !ctx) return;

    // captura pra não perder o desenho em fullscreen/pseudo
    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}

    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawActiveRef.current = true;
    drawLastRef.current = { x, y };

    const dpr = window.devicePixelRatio || 1;
    const color = role === "admin" ? "#22c55e" : "#f97316";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // not draw a dot; begin segment
    void sendDraw({ t: "begin", x: x / rect.width, y: y / rect.height, color, w: 3 }).catch(() => {});
  };

  const onDrawPointerMove = async (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawOn) return;
    if (!drawActiveRef.current) return;
    const box = contentAreaRef.current;
    const ctx = drawCtxRef.current;
    if (!box || !ctx) return;
    const last = drawLastRef.current;
    if (!last) return;

    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    ctx.beginPath();
    ctx.moveTo(last.x * dpr, last.y * dpr);
    ctx.lineTo(x * dpr, y * dpr);
    ctx.stroke();
    drawLastRef.current = { x, y };

    const now = Date.now();
    if (now - drawSendTsRef.current > 30) {
      drawSendTsRef.current = now;
      // envia coordenadas normalizadas
      void sendDraw({ t: "move", x: x / rect.width, y: y / rect.height, color: ctx.strokeStyle, w: 3 }).catch(() => {});
    }
  };

  const onDrawPointerUp = async () => {
    if (!drawOn) return;
    if (!drawActiveRef.current) return;
    drawActiveRef.current = false;
    drawLastRef.current = null;
    void sendDraw({ t: "end" }).catch(() => {});
  };

  const startMedia = async () => {
    try {
      setMediaState("requesting");
      setMediaError(null);
      await ensurePeer();

      // Idempotente: se já temos stream, reaproveita.
      const stream =
        localStream ??
        (await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        }));

      if (!localStream) {
        setLocalStream(stream);
      }

      setMicOn(stream.getAudioTracks().every((t) => t.enabled));
      setCamOn(stream.getVideoTracks().every((t) => t.enabled));

      // Evita addTrack duplicado (pode disparar exceções e "quebrar" a sessão em iOS)
      const pc = pcRef.current;
      if (pc) {
        const hasSenders = pc.getSenders().some((s) => !!s.track);
        if (!hasSenders) {
          for (const track of stream.getTracks()) {
            try {
              pc.addTrack(track, stream);
            } catch (e) {
              console.warn("[WebRTC] addTrack falhou (ignorado)", e);
            }
          }
        }
      }

      setMediaState("ready");
      setMediaError(null);
      setStatusLabel("Aguardando o outro participante…");

      // tentar liberar WebAudio após gesto do usuário (borda por voz)
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      } catch {}

      // Admin inicia offer ao ficar pronto
      if (role === "admin") {
        const pc2 = pcRef.current;
        if (pc2) {
          const offer = await pc2.createOffer();
          await pc2.setLocalDescription(offer);
        await send("webrtc_offer", { sdp: { type: pc2.localDescription?.type, sdp: pc2.localDescription?.sdp } });
        }
      }

      // Se o usuário já recebeu offer antes, responde agora
      if (role === "user" && pendingOfferRef.current && pcRef.current) {
        const sdp = normalizeSdpInit(pendingOfferRef.current);
        pendingOfferRef.current = null;
        if (!sdp) throw new Error("SDP inválido (offer pendente).");
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIce();
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        await send("webrtc_answer", {
          sdp: { type: pcRef.current.localDescription?.type, sdp: pcRef.current.localDescription?.sdp },
        });
      }
    } catch (e: any) {
      console.error("[WebRTC] falha ao iniciar sessão (mídia/webrtc)", e);
      const name = String(e?.name || "");
      const details = String(e?.message || "");
      const isSdp = details.includes("Invalid SDP") || details.includes("SDP inválido") || details.includes("Invalid SDP line");
      const msg =
        isSdp
          ? "Falha WebRTC (SDP inválido). Saia e entre novamente."
          : name.includes("NotAllowed")
          ? "Permissão negada. Autorize câmera e microfone."
          : name.includes("NotFound")
          ? "Não encontrei câmera/microfone neste dispositivo."
          : name.includes("NotReadable")
          ? "Não foi possível iniciar a câmera (ela pode estar em uso por outro app/aba)."
          : "Falha ao iniciar câmera/microfone.";

      const full = details ? `${msg} (${name}: ${details})` : `${msg} (${name})`;
      setMediaState("failed");
      setMediaError(full);
      toast({ title: "WebRTC", description: msg, variant: "destructive" });
    }
  };

  const ensureAudioCtx = async (): Promise<AudioContext | null> => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const startVoiceActivity = async (stream: MediaStream, which: "local" | "remote") => {
    const ctx = await ensureAudioCtx();
    if (!ctx) return;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const threshold = 0.06; // bem simples
    const holdMs = 250;
    let lastHot = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const now = Date.now();
      const hot = rms >= threshold;
      if (hot) lastHot = now;
      const speaking = hot || now - lastHot < holdMs;
      if (which === "local") setLocalSpeaking(speaking);
      else setRemoteSpeaking(speaking);
      const raf = window.requestAnimationFrame(tick);
      if (which === "local") localVafRef.current = raf;
      else remoteVafRef.current = raf;
    };

    tick();
  };

  useEffect(() => {
    // local VAD
    if (!localStream) return;
    if (!localStream.getAudioTracks().length) return;
    if (localVafRef.current) window.cancelAnimationFrame(localVafRef.current);
    localVafRef.current = null;
    void startVoiceActivity(localStream, "local");
    return () => {
      if (localVafRef.current) window.cancelAnimationFrame(localVafRef.current);
      localVafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  useEffect(() => {
    // remote VAD
    if (!remoteStream) return;
    if (!remoteStream.getAudioTracks().length) return;
    if (remoteVafRef.current) window.cancelAnimationFrame(remoteVafRef.current);
    remoteVafRef.current = null;
    void startVoiceActivity(remoteStream, "remote");
    return () => {
      if (remoteVafRef.current) window.cancelAnimationFrame(remoteVafRef.current);
      remoteVafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStream]);

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

  const iframeSrc = (() => {
    if (!contentPath) return null;
    if (contentPath.startsWith("http")) return contentPath;
    try {
      const base = new URL(window.location.origin + contentPath);
      // habilita modo sessão dentro das páginas de jogos/atividades (apenas comportamento adicional)
      base.searchParams.set("session", "1");
      if (joinInfo?.sessionId) base.searchParams.set("session_id", String(joinInfo.sessionId));
      if (role) base.searchParams.set("session_role", role);
      if (typeof contentSeed === "number") base.searchParams.set("session_seed", String(contentSeed));
      return base.pathname + (base.search ? base.search : "");
    } catch {
      return contentPath;
    }
  })();

  return (
    <div className="min-h-[100svh] bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Sementes da Fala" className="h-8 w-8 rounded-lg object-cover" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Sessão ao vivo</div>
              <div className="text-xs text-muted-foreground">{statusLabel}</div>
              {mediaState === "failed" && mediaError ? (
                <div className="text-[11px] text-destructive mt-0.5">{mediaError}</div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>{callElapsedLabel}</span>
            </div>
            <div>ID {appointmentId}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Área principal (conteúdo da sessão) */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div ref={contentAreaRef} className="relative w-full h-[60vh] lg:h-[70vh]">
              {screenShareActive ? (
                <div className="absolute inset-0 rounded-xl bg-black overflow-hidden">
                  <video
                    ref={contentScreenVideoRef}
                    className="h-full w-full object-contain"
                    autoPlay
                    playsInline
                    muted
                    controls={false}
                  />
                </div>
              ) : iframeSrc ? (
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  ref={contentFrameRef}
                  className="absolute inset-0 h-full w-full rounded-xl bg-background"
                  title="Conteúdo da sessão"
                  onLoad={() => setContentLoading(false)}
                  style={{
                    // Sem reação visual: apenas bloqueia interação quando não liberado
                    pointerEvents:
                      drawOn ? "none" : role === "user" && !controlGranted ? "none" : "auto",
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background">
                  {role === "user" ? (
                    <div className="text-center max-w-md">
                      <img
                        src={logoImage}
                        alt="Sementes da Fala"
                        className="h-16 w-16 mx-auto mb-4 rounded-2xl object-cover"
                      />
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
              )}

              {/* Rabisco sincronizado (canvas) */}
              <canvas
                ref={drawCanvasRef}
                className="absolute inset-0 rounded-xl"
                style={{
                  pointerEvents: drawOn ? "auto" : "none",
                  touchAction: drawOn ? "none" : "auto",
                }}
                onPointerDown={(e) => void onDrawPointerDown(e)}
                onPointerMove={(e) => void onDrawPointerMove(e)}
                onPointerUp={() => void onDrawPointerUp()}
                onPointerCancel={() => void onDrawPointerUp()}
              />

              {contentLoading && (
                <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="text-sm font-semibold text-foreground">Carregando…</div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna de câmeras */}
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-2xl border bg-card overflow-hidden transition-[box-shadow,border-color] duration-150",
                remoteSpeaking ? "border-brand-green shadow-[0_0_0_2px_rgba(34,197,94,0.35)]" : "border-border"
              )}
            >
              <div className="px-3 py-2 text-xs font-semibold text-foreground border-b border-border">
                {role === "admin" ? "Paciente" : "Fonoaudióloga"}
              </div>
              <div className="relative aspect-[4/3] bg-black">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={remoteMuted}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border bg-card overflow-hidden transition-[box-shadow,border-color] duration-150",
                localSpeaking ? "border-brand-orange shadow-[0_0_0_2px_rgba(249,115,22,0.35)]" : "border-border"
              )}
            >
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
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {mediaState !== "ready" && (
            <Button
              onClick={() => void startMedia()}
              disabled={mediaState === "requesting"}
              className="rounded-xl bg-brand-green text-white hover:bg-brand-green/90"
            >
              {mediaState === "requesting" ? "Iniciando…" : "Iniciar câmera e microfone"}
            </Button>
          )}
          {role === "admin" && (
            <>
              <Button variant="outline" onClick={() => setCatalogOpen(true)} className="rounded-xl">
                Catálogo (atividades/jogos)
              </Button>
              <Button variant="outline" onClick={() => setPackagesOpen(true)} className="rounded-xl">
                <Package className="h-4 w-4 mr-2" />
                Pacotes
              </Button>
              <Button variant="outline" onClick={() => setReportOpen(true)} className="rounded-xl">
                <FileText className="h-4 w-4 mr-2" />
                Relatório
              </Button>
              <Button variant="outline" onClick={() => void toggleControl()} className="rounded-xl">
                {controlGranted ? "Retirar controle do paciente" : "Dar controle ao paciente"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void (screenSharing ? stopScreenShare() : startScreenShare())}
                className={cn("rounded-xl", screenSharing ? "border-brand-green text-brand-green" : "")}
                disabled={mediaState !== "ready"}
                title={screenSharing ? "Parar compartilhamento de tela" : "Compartilhar a tela"}
              >
                <MonitorUp className="h-4 w-4 mr-2" />
                {screenSharing ? "Parar tela" : "Compartilhar tela"}
              </Button>
            </>
          )}

          {/* Áudio remoto (ajuda iOS/Safari a liberar autoplay ao usuário tocar) */}
          <Button
            variant="outline"
            onClick={() => {
              const next = !remoteMuted;
              setRemoteMuted(next);
              // tentar play após interação
              const el = remoteVideoRef.current;
              if (el) void el.play().catch(() => {});
            }}
            className={cn("rounded-xl", remoteMuted ? "" : "border-brand-green text-brand-green")}
          >
            {remoteMuted ? "Ativar áudio" : "Silenciar áudio"}
          </Button>

          {/* Controles locais: também para usuário */}
          {mediaState === "ready" && (
            <>
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
            </>
          )}

          {/* Rabisco (admin e usuário) */}
          <Button
            variant="outline"
            onClick={() => setDrawOn((v) => !v)}
            className={cn("rounded-xl", drawOn ? "border-brand-green text-brand-green" : "")}
            title="Rabiscar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {drawOn && (
            <Button variant="outline" onClick={() => void clearDoodle()} className="rounded-xl" title="Limpar rabiscos">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button variant="destructive" onClick={() => void hangup()} className="rounded-xl">
            <PhoneOff />
          </Button>
        </div>
      </div>

      {/* Catálogo (admin): atividades + jogos */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catálogo (atividades e jogos)</DialogTitle>
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
                      onClick={() => {
                        setPendingShare({ path: `/atividades/${a.id}`, title: a.title, kind: "activity" });
                        setShareConfirmOpen(true);
                      }}
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
                      onClick={() => {
                        setPendingShare({ path: `/jogos/${g.id}`, title: g.title, kind: "memory_game" });
                        setShareConfirmOpen(true);
                      }}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Jogo da Memória</div>
                    </button>
                  ))}
                  {audGames.map((g) => (
                    <button
                      key={`aud-${g.id}`}
                      onClick={() => {
                        setPendingShare({ path: `/jogos/auditivo/${g.id}`, title: g.title, kind: "auditory_game" });
                        setShareConfirmOpen(true);
                      }}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Estimulação Auditiva</div>
                    </button>
                  ))}
                  {hangGames.map((g) => (
                    <button
                      key={`hang-${g.id}`}
                      onClick={() => {
                        setPendingShare({ path: `/jogos/forca/${g.id}`, title: g.title, kind: "hangman_game" });
                        setShareConfirmOpen(true);
                      }}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Jogo da Forca</div>
                    </button>
                  ))}
                  {spinGames.map((g) => (
                    <button
                      key={`spin-${g.id}`}
                      onClick={() => {
                        setPendingShare({ path: `/jogos/roleta/${g.id}`, title: g.title, kind: "spin_wheel_game" });
                        setShareConfirmOpen(true);
                      }}
                      className="text-left rounded-xl border border-border bg-card hover:bg-accent px-3 py-2"
                    >
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{g.title}</div>
                      <div className="text-xs text-muted-foreground">Roleta</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Catálogo de pacotes (admin) */}
      <Dialog open={packagesOpen} onOpenChange={setPackagesOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pacotes (catálogo de preços)</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {packageCatalog.map((p) => (
              <div key={`pkg-${p.sessions}`} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{p.sessions} sessões</div>
                    <div className="text-xs text-muted-foreground">
                      Total: {p.priceLabel} • {p.perSessionLabel}/sessão
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      setPendingPayment({ sessions: p.sessions, url: p.url });
                      setPaymentConfirmOpen(true);
                    }}
                  >
                    Enviar link
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            O link abre apenas para o paciente (ele confirma com um clique, sem interromper a ligação).
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de envio de pagamento (admin) */}
      {role === "admin" && pendingPayment ? (
        <BrandedConfirmDialog
          open={paymentConfirmOpen}
          onOpenChange={(open) => {
            setPaymentConfirmOpen(open);
            if (!open) setPendingPayment(null);
          }}
          title="Pagamento"
          description={`Enviar link do Mercado Pago (${pendingPayment.sessions} sessões) para o paciente agora?`}
          confirmText="Enviar"
          cancelText="Cancelar"
          onConfirm={() =>
            void sendPayment(pendingPayment.sessions, pendingPayment.url).finally(() => {
              setPaymentConfirmOpen(false);
              setPendingPayment(null);
              setPackagesOpen(false);
            })
          }
        />
      ) : null}

      {/* Pagamento (user): abre só com clique */}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setPaymentUrl(null);
            setPaymentSessions(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {paymentSessions ? `Link de pagamento para ${paymentSessions} sessões.` : "Link de pagamento enviado pela fonoaudióloga."}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPaymentDialogOpen(false)}>
              Agora não
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => {
                if (paymentUrl) {
                  // registra intenção (para aparecer no admin/perfil), mas não bloqueia o fluxo
                  if (paymentSessions) {
                    void api.userRegisterPurchaseIntent({ package_sessions: paymentSessions }).catch(() => {});
                  }
                  window.open(paymentUrl, "_blank", "noopener,noreferrer");
                }
                setPaymentDialogOpen(false);
              }}
            >
              Abrir Mercado Pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Relatório (admin) */}
      {role === "admin" ? (
        <Suspense fallback={null}>
          <ReportFormModalLazy
            open={reportOpen}
            mode="create"
            initial={null}
            fixedUser={fixedUser}
            onOpenChange={setReportOpen}
            onSubmit={async (payload) => {
              await api.adminCreateReport(payload);
              toast({ title: "Relatório", description: "Relatório criado com sucesso." });
            }}
          />
        </Suspense>
      ) : null}

      {/* Confirmação de compartilhamento (admin) */}
      {role === "admin" && pendingShare ? (
        <BrandedConfirmDialog
          open={shareConfirmOpen}
          onOpenChange={(open) => {
            setShareConfirmOpen(open);
            if (!open) setPendingShare(null);
          }}
          title="Compartilhar agora?"
          description={`Você quer compartilhar "${pendingShare.title}" com o paciente agora?`}
          confirmLabel="Compartilhar"
          cancelLabel="Cancelar"
          variant="success"
          onConfirm={() => void selectContent(pendingShare.path, pendingShare.title, pendingShare.kind)}
        />
      ) : null}
    </div>
  );
}

