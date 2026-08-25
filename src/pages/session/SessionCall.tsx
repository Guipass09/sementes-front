import type { PointerEvent as ReactPointerEvent } from "react";
import type { ReportFormDraft } from "@/features/reports/ReportFormModal";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Clock3,
  FileText,
  Eraser,
  Mic,
  MicOff,
  MonitorUp,
  Package,
  Pencil,
  PhoneOff,
  Video,
  VideoOff,
  Sparkles,
} from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/laravel-api";
import type {
  ActivityRow,
  MemoryGameRow,
  AuditoryGameRow,
  HangmanGameRow,
  SpinWheelGameRow,
  WordSearchGameRow,
  CardGameRow,
  GuessImageGameRow,
} from "@/lib/laravel-api";
import type { PhonemeGameRow } from "@/lib/laravel-api";
import {
  isApiError,
  videoJoin,
  videoJoinInvite,
  videoPoll,
  videoPollInvite,
  videoSendCommand,
  videoSendCommandInvite,
  type VideoJoinResponse,
  type VideoPollMessage,
} from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";
import { playFanfare } from "@/lib/sfx";
import RtcPaymentModal from "@/features/payments/RtcPaymentModal";
import { Textarea } from "@/components/ui/textarea";

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
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const { user, loading: authLoading } = auth;
  const { toast } = useToast();

  const inviteToken = useMemo(() => {
    const t =
      searchParams.get("invite_token") ||
      searchParams.get("invite") ||
      searchParams.get("token") ||
      "";
    return t.trim() ? t.trim() : null;
  }, [searchParams]);

  const appRole = useMemo(() => {
    const raw = String(user?.role ?? "").toLowerCase().trim();
    if (raw.includes("professional") || raw.includes("profissional")) return "professional" as const;
    if (raw.includes("admin")) return "admin" as const;
    return "user" as const;
  }, [user?.role]);

  const appointmentId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const [joining, setJoining] = useState(true);
  const [joinInfo, setJoinInfo] = useState<VideoJoinResponse | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const [pendingOfferAvailable, setPendingOfferAvailable] = useState(false);
  const didInviteAutoRedirectRef = useRef(false);
  const didReconnectRequestRef = useRef(false);
  const lastAppointmentIdRef = useRef<number | null>(null);
  const joinedAtMsRef = useRef<number>(0);
  const [epoch, setEpoch] = useState<string | null>(null);
  const epochRef = useRef<string | null>(null);
  const pendingWebrtcRef = useRef<VideoPollMessage[]>([]);
  const pendingIceRef = useRef<any[]>([]);
  const pendingOfferRef = useRef<any | null>(null);
  const peerReadyRef = useRef(false);
  const ensurePeerRef = useRef<Promise<void> | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteCamStream, setRemoteCamStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string>("Conectando...");
  const [remotePresent, setRemotePresent] = useState(false);
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
  const [catalogTab, setCatalogTab] = useState<"meu" | "compartilhados">("meu");
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [memGames, setMemGames] = useState<MemoryGameRow[]>([]);
  const [memGames2, setMemGames2] = useState<MemoryGameRow[]>([]);
  const [phonemeGames, setPhonemeGames] = useState<PhonemeGameRow[]>([]);
  const [audGames, setAudGames] = useState<AuditoryGameRow[]>([]);
  const [hangGames, setHangGames] = useState<HangmanGameRow[]>([]);
  const [spinGames, setSpinGames] = useState<SpinWheelGameRow[]>([]);
  const [wordSearchGames, setWordSearchGames] = useState<WordSearchGameRow[]>([]);
  const [cardGames, setCardGames] = useState<CardGameRow[]>([]);
  const [guessImageGames, setGuessImageGames] = useState<GuessImageGameRow[]>([]);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<null | { path: string; title: string; kind: string }>(null);
  const [pendingPayment, setPendingPayment] = useState<null | { sessions: number; amount: number; url?: string }>(null);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentSessions, setPaymentSessions] = useState<number | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentIframeOpen, setPaymentIframeOpen] = useState(false);
  const [endSessionOpen, setEndSessionOpen] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  // Checkout embutido (Pix/Cartão) dentro da sessão
  const [rtcPaymentOpen, setRtcPaymentOpen] = useState(false);
  const [rtcPaymentMeta, setRtcPaymentMeta] = useState<
    null | { sessions: number | null; amount: number; defaultTab?: "pix" | "card"; maxInstallments?: number }
  >(null);
  const [rtcPaymentLocked, setRtcPaymentLocked] = useState(false);

  // Mantém áudio/vídeo ativos em iOS enquanto overlays (pagamento) estão abertos.
  const paymentOverlayActive = rtcPaymentOpen || paymentIframeOpen || paymentDialogOpen;
  const paymentMiniRemoteRef = useRef<HTMLVideoElement | null>(null);
  const paymentMiniLocalRef = useRef<HTMLVideoElement | null>(null);

  const [customPayOpen, setCustomPayOpen] = useState(false);
  const [customPayAmount, setCustomPayAmount] = useState<string>("");
  const [customPaySessions, setCustomPaySessions] = useState<string>("");
  const [customPayMethod, setCustomPayMethod] = useState<"pix" | "card">("card");

  // Segurança: nada de um atendimento pode "vazar" para outro.
  // Ao trocar de appointment, zeramos TODOS os estados de pagamento e removemos referências de join/poll antigas,
  // para evitar reabrir modais/iframes de um paciente anterior no próximo.
  useEffect(() => {
    if (lastAppointmentIdRef.current === appointmentId) return;
    lastAppointmentIdRef.current = appointmentId;

    // Pagamento (externo e embutido)
    setRtcPaymentOpen(false);
    setRtcPaymentMeta(null);
    setRtcPaymentLocked(false);
    setPaymentIframeOpen(false);
    setPaymentDialogOpen(false);
    setPaymentUrl(null);
    setPaymentSessions(null);
    setPaymentConfirmOpen(false);
    setPendingPayment(null);
    setCustomPayOpen(false);

    // Evita que loops/mensagens do appointment anterior continuem afetando a UI
    setJoinInfo(null);
    setRole(null);
    cursorRef.current = 0;
    setCursor(0);
    epochRef.current = null;
    setEpoch(null);
    pendingWebrtcRef.current = [];
    pendingIceRef.current = [];
    pendingOfferRef.current = null;
    setPendingOfferAvailable(false);
    didInviteAutoRedirectRef.current = false;
    didReconnectRequestRef.current = false;
    joinedAtMsRef.current = 0;
  }, [appointmentId]);

  const [proCommentOpen, setProCommentOpen] = useState(false);
  const [proCommentText, setProCommentText] = useState("");
  const [proCommentSaving, setProCommentSaving] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportDraft, setReportDraft] = useState<ReportFormDraft | null>(null);
  const reportMinimizedRef = useRef(false);

  const catalogView = useMemo(() => {
    const myId = user?.id ?? 0;
    const mk = (rows: any[]) => {
      if (appRole !== "professional") return { mine: rows, shared: [] as any[] };
      return {
        mine: rows.filter((r) => (r?.created_by?.id ?? 0) === myId),
        shared: rows.filter((r) => (r?.created_by?.id ?? 0) !== myId),
      };
    };
    const acts = mk(activities as any[]);
    const mem = mk(memGames as any[]);
    const mem2 = mk(memGames2 as any[]);
    const phon = mk(phonemeGames as any[]);
    const aud = mk(audGames as any[]);
    const hang = mk(hangGames as any[]);
    const spin = mk(spinGames as any[]);
    const ws = mk(wordSearchGames as any[]);
    const cards = mk(cardGames as any[]);
    const guess = mk(guessImageGames as any[]);
    return {
      mine: {
        activities: acts.mine as ActivityRow[],
        memGames: mem.mine as MemoryGameRow[],
        memGames2: mem2.mine as MemoryGameRow[],
        phonemeGames: phon.mine as PhonemeGameRow[],
        audGames: aud.mine as AuditoryGameRow[],
        hangGames: hang.mine as HangmanGameRow[],
        spinGames: spin.mine as SpinWheelGameRow[],
        wordSearchGames: ws.mine as WordSearchGameRow[],
        cardGames: cards.mine as CardGameRow[],
        guessImageGames: guess.mine as GuessImageGameRow[],
      },
      shared: {
        activities: acts.shared as ActivityRow[],
        memGames: mem.shared as MemoryGameRow[],
        memGames2: mem2.shared as MemoryGameRow[],
        phonemeGames: phon.shared as PhonemeGameRow[],
        audGames: aud.shared as AuditoryGameRow[],
        hangGames: hang.shared as HangmanGameRow[],
        spinGames: spin.shared as SpinWheelGameRow[],
        wordSearchGames: ws.shared as WordSearchGameRow[],
        cardGames: cards.shared as CardGameRow[],
        guessImageGames: guess.shared as GuessImageGameRow[],
      },
    };
  }, [appRole, user?.id, activities, memGames, memGames2, phonemeGames, audGames, hangGames, spinGames, wordSearchGames, cardGames, guessImageGames]);

  const activeCatalog = appRole === "professional" ? (catalogTab === "compartilhados" ? catalogView.shared : catalogView.mine) : catalogView.mine;
  const catActivities = activeCatalog.activities;
  const catMemGames = activeCatalog.memGames;
  const catMemGames2 = activeCatalog.memGames2;
  const catPhonemeGames = activeCatalog.phonemeGames;
  const catAudGames = activeCatalog.audGames;
  const catHangGames = activeCatalog.hangGames;
  const catSpinGames = activeCatalog.spinGames;
  const catWordSearchGames = activeCatalog.wordSearchGames;
  const catCardGames = activeCatalog.cardGames;
  const catGuessImageGames = activeCatalog.guessImageGames;
  const [fixedUser, setFixedUser] = useState<null | { id: number; name: string }>(null);

  const [callStartedAtMs, setCallStartedAtMs] = useState<number | null>(null);
  const [callElapsedLabel, setCallElapsedLabel] = useState<string>("00:00");
  const didForceReloadRef = useRef(false);

  const [drawOn, setDrawOn] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const drawCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawActiveRef = useRef(false);
  const drawLastRef = useRef<{ x: number; y: number } | null>(null);
  const drawRemoteLastRef = useRef<Record<string, { x: number; y: number } | null>>({});
  const drawSendTsRef = useRef(0);

  const [confettiActive, setConfettiActive] = useState(false);
  const confettiKeyRef = useRef(0);

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
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const screenTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const screenAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const screenAudioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const contentFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const joiningRef = useRef(false);
  const resumeInFlightRef = useRef(false);

  const goBack = (markCompleted?: boolean) => {
    // Se entrou via link público (sem login), volta para o login.
    if (!user) {
      navigate("/entrar");
      return;
    }
    if (appRole === "admin") {
      navigate("/admin/horarios");
      return;
    }
    if (appRole === "professional") {
      navigate(markCompleted ? "/profissional/historico" : "/profissional/horarios");
      return;
    }
    navigate("/paciente/sessoes");
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
    // Sem login: só permite permanecer aqui se veio por link público (invite_token).
    if (!authLoading && !user && !inviteToken) navigate("/entrar");
  }, [authLoading, user, inviteToken, navigate]);

  const tryClearCaches = useCallback(async () => {
    // Melhor esforço: em PWA/cache agressivo, limpar caches ajuda em atualizações.
    try {
      const W: any = window as any;
      if (!W?.caches?.keys || !W?.caches?.delete) return;
      const keys: string[] = await W.caches.keys();
      await Promise.all(keys.map((k) => W.caches.delete(k)));
    } catch {
      // ignore
    }
  }, []);

  const refreshPage = useCallback(() => {
    // Mantém timer via sessionStorage (call_started_at:*).
    // Tenta “furar cache” adicionando query param.
    void tryClearCaches();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("__reload", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }, [tryClearCaches]);

  const handleRtcPaid = useCallback(() => {
    // Não fechar a chamada nem derrubar streams — apenas desbloquear.
    // O modal exibe "pagamento aprovado" e o usuário pode fechar manualmente.
    setRtcPaymentLocked(false);
    // Se ainda não conseguiu fazer join (402), recarrega para tentar entrar já liberado
    if (!joinInfo) {
      refreshPage();
    }
  }, [joinInfo, refreshPage]);

  // Re-join robusto:
  // - mantém o temporizador salvo
  // - ao voltar para a chamada depois de sair, força 1 reload para limpar o estado do WebRTC
  useEffect(() => {
    if (!appointmentId) return;
    const startKey = `call_started_at:${appointmentId}`;
    const reloadKey = `call_force_reload:${appointmentId}`;

    const savedStart = Number(sessionStorage.getItem(startKey) || "0");
    if (!callStartedAtMs && Number.isFinite(savedStart) && savedStart > 0) {
      setCallStartedAtMs(savedStart);
    }

    const pendingReload = Number(sessionStorage.getItem(reloadKey) || "0");
    if (!didForceReloadRef.current && Number.isFinite(pendingReload) && pendingReload > 0) {
      didForceReloadRef.current = true;
      sessionStorage.removeItem(reloadKey);
      const url = new URL(window.location.href);
      url.searchParams.set("__rejoin", String(Date.now()));
      window.location.replace(url.toString());
    }
  }, [appointmentId, callStartedAtMs]);

  // PWA/mobile: "pull to refresh" (puxar além do topo/rodapé recarrega a página)
  useEffect(() => {
    // Durante pagamentos/modais, não permitir gesto que recarrega a página (interrompe WebRTC/áudio).
    const gestureRefreshDisabled = rtcPaymentOpen || paymentIframeOpen || paymentDialogOpen;

    const se = () => (document.scrollingElement || document.documentElement) as any;
    const stateRef = {
      armed: false,
      fired: false,
      startY: 0,
      startX: 0,
      startAt: 0,
      mode: "" as "" | "top" | "bottom",
    };

    const atTop = () => {
      const el = se();
      const top = Number(el?.scrollTop || 0);
      return top <= 0;
    };
    const atBottom = () => {
      const el = se();
      const top = Number(el?.scrollTop || 0);
      const max = Math.max(0, Number(el?.scrollHeight || 0) - window.innerHeight);
      return top >= max - 1;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!e.touches?.length) return;
      if (drawOn) return;
      if (gestureRefreshDisabled) return;
      stateRef.armed = false;
      stateRef.fired = false;
      stateRef.mode = "";
      stateRef.startY = e.touches[0].clientY;
      stateRef.startX = e.touches[0].clientX;
      stateRef.startAt = Date.now();

      // Para ficar menos sensível: só arma se o gesto começar perto da borda (topo/rodapé).
      const edgeZonePx = 80;
      if (atTop()) {
        if (stateRef.startY <= edgeZonePx) {
          stateRef.armed = true;
          stateRef.mode = "top";
        }
      } else if (atBottom()) {
        if (stateRef.startY >= window.innerHeight - edgeZonePx) {
          stateRef.armed = true;
          stateRef.mode = "bottom";
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!stateRef.armed || stateRef.fired) return;
      if (!e.touches?.length) return;
      if (drawOn) return;
      if (gestureRefreshDisabled) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = x - stateRef.startX;
      const dy = y - stateRef.startY;

      // Ignora gestos mais "horizontais" (ex.: carrossel/arrasto lateral).
      if (Math.abs(dy) < Math.abs(dx) * 1.15) return;

      // Menos sensível: precisa puxar mais e por mais tempo.
      const minMs = 320;
      const threshold = 180; // px
      if (Date.now() - stateRef.startAt < minMs) return;

      if (stateRef.mode === "top") {
        if (dy > threshold && atTop()) {
          stateRef.fired = true;
          refreshPage();
        }
      } else if (stateRef.mode === "bottom") {
        if (dy < -threshold && atBottom()) {
          stateRef.fired = true;
          refreshPage();
        }
      }
    };

    const onTouchEnd = () => {
      stateRef.armed = false;
      stateRef.fired = false;
      stateRef.mode = "";
      stateRef.startY = 0;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true } as any);
    window.addEventListener("touchmove", onTouchMove, { passive: true } as any);
    window.addEventListener("touchend", onTouchEnd, { passive: true } as any);
    window.addEventListener("touchcancel", onTouchEnd, { passive: true } as any);
    return () => {
      window.removeEventListener("touchstart", onTouchStart as any);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("touchend", onTouchEnd as any);
      window.removeEventListener("touchcancel", onTouchEnd as any);
    };
  }, [drawOn, refreshPage, rtcPaymentOpen, paymentIframeOpen, paymentDialogOpen]);

  // Quando screen share estiver ativo:
  // - admin mostra o próprio display stream no painel grande
  // - user mostra o remoteScreenStream (2º track de vídeo)
  useEffect(() => {
    if (!screenShareActive) return;
    const el = contentScreenVideoRef.current;
    if (!el) return;
    const stream = role === "admin" ? screenStreamRef.current : remoteScreenStream;
    if (!stream) return;
    el.srcObject = stream;
    el.muted = true; // áudio continua controlado pelo vídeo remoto na lateral
    void el.play().catch(() => {});
  }, [screenShareActive, role, remoteScreenStream]);

  // Alguns browsers não “reatualizam” o <video> quando o MediaStream ganha um track depois.
  // Forçamos re-attach quando o track de tela chega.
  useEffect(() => {
    if (!remoteScreenStream) return;
    const el = contentScreenVideoRef.current;
    if (!el) return;
    const onAdd = () => {
      if (!screenShareActive) return;
      if (role !== "user") return;
      el.srcObject = remoteScreenStream;
      void el.play().catch(() => {});
    };
    remoteScreenStream.addEventListener("addtrack", onAdd as any);
    remoteScreenStream.addEventListener("removetrack", onAdd as any);
    return () => {
      remoteScreenStream.removeEventListener("addtrack", onAdd as any);
      remoteScreenStream.removeEventListener("removetrack", onAdd as any);
    };
  }, [remoteScreenStream, screenShareActive, role]);

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
    if (!appointmentId) return;
    if (joiningRef.current) return;

    const isAuthed = !!user;
    const isInviteFlow = !user && !!inviteToken;

    if (!isAuthed && !isInviteFlow) return;

    joiningRef.current = true;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    (async () => {
      setJoining(true);
      setStatusLabel("Entrando na sessão...");
      
      // Timeout de segurança: se não completar em 30 segundos, cancela e mostra erro
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          cancelled = true;
          setJoining(false);
          joiningRef.current = false;
          toast({ 
            title: "Sessão", 
            description: "Tempo limite excedido ao entrar na sessão. Tente novamente.", 
            variant: "destructive" 
          });
        }
      }, 30000);
      
      try {
        const res = isAuthed
          ? await videoJoin(appointmentId)
          : await videoJoinInvite({
              appointment_id: appointmentId,
              invite_token: inviteToken as string,
            });
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);

        // Fluxo do link: após validar o convite e receber auth, redireciona para a mesma rota já logado
        // (sem invite_token). Isso garante que o WebRTC rode no mesmo fluxo do app "normal"
        // e evita a necessidade do usuário dar refresh manual.
        if (
          !isAuthed &&
          !didInviteAutoRedirectRef.current &&
          (res as any)?.auth?.token &&
          (res as any)?.auth?.user
        ) {
          didInviteAutoRedirectRef.current = true;
          try {
            const token = String((res as any).auth.token || "").trim();
            const u = (res as any).auth.user;
            if (token) {
              localStorage.setItem("token", token);
              localStorage.setItem("user", JSON.stringify(u));
              auth.setAuthUser(u);
            }
          } catch {
            // ignore
          }
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("invite_token");
            url.searchParams.delete("invite");
            url.searchParams.delete("token");
            url.searchParams.set("__reload", String(Date.now()));
            window.location.replace(url.pathname + url.search);
          } catch {
            window.location.replace(`/sessao/${appointmentId}/chamada?__reload=${Date.now()}`);
          }
          return;
        }
        
        setJoinInfo(res);
        setRole(res.role);
        // Timer: inicia uma vez e persiste entre reloads/saída-volta
        const startKey = `call_started_at:${appointmentId}`;
        const savedStart = Number(sessionStorage.getItem(startKey) || "0");
        const start = Number.isFinite(savedStart) && savedStart > 0 ? savedStart : Date.now();
        sessionStorage.setItem(startKey, String(start));
        setCallStartedAtMs(start);
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
        setStatusLabel("Toque em Participar");
        setMediaState("idle");
        setMediaError(null);
        // Marca "início desta entrada" para ignorar comandos antigos (ex.: pagamento) ao entrar via link.
        joinedAtMsRef.current = Date.now();
        joiningRef.current = false; // Reset para permitir novo join se necessário
      } catch (e) {
        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);
        joiningRef.current = false; // Reset em caso de erro

        // Pagamento obrigatório (402):
        // NÃO abrir checkout automaticamente ao iniciar a chamada (evita "vazar" tela de pagamento).
        // Se o pagamento for necessário, o admin/profissional deve solicitar manualmente durante a sessão.
        if (isApiError(e) && e.status === 402 && ((e as any).data?.payment_required || (e as any).data?.message === "payment_required")) {
          setJoinInfo(null);
          setRole(null);
          setJoining(false);
          setStatusLabel("Sessão com pagamento pendente. Aguarde o profissional/admin solicitar o pagamento.");
          toast({
            title: "Sessão",
            description: "Pagamento pendente. Aguarde o profissional/admin solicitar o pagamento para você.",
            variant: "destructive",
          });
          return;
        }

        const msg =
          isApiError(e) && e.status === 403
            ? (typeof (e as any)?.data?.message === "string" && (e as any).data.message
                ? String((e as any).data.message)
                : "Essa sessão ainda não está disponível. Tente mais perto do horário.")
            : "Não foi possível entrar na sessão.";
        toast({ title: "Sessão", description: msg, variant: "destructive" });
        setJoinInfo(null);
        setRole(null);
        setJoining(false);
        // volta para lista
        setTimeout(() => {
          goBack(false);
        }, 2000); // Delay para mostrar o toast
      } finally {
        if (!cancelled && timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setJoining(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      joiningRef.current = false; // Reset ao desmontar
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, user, inviteToken]);

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
    const s = remoteCamStream || remoteStream;
    if (s) {
      el.srcObject = s;
      // Não mutar: o áudio remoto deve passar sempre.
      el.muted = false;
      void el.play().catch(() => {});
    }
  }, [remoteCamStream, remoteStream]);

  // Pagamento: mantém um video remoto "visível" no DOM em iOS (evita pausar áudio/vídeo por ficar coberto).
  useEffect(() => {
    if (!paymentOverlayActive) return;
    try {
      const remoteEl = paymentMiniRemoteRef.current;
      const s = remoteCamStream || remoteStream;
      if (remoteEl && s) {
        remoteEl.srcObject = s;
        remoteEl.muted = false;
        void remoteEl.play().catch(() => {});
      }
    } catch {}
    try {
      const localEl = paymentMiniLocalRef.current;
      if (localEl && localStream) {
        localEl.srcObject = localStream;
        localEl.muted = true;
        void localEl.play().catch(() => {});
      }
    } catch {}
  }, [paymentOverlayActive, remoteCamStream, remoteStream, localStream]);

  // Timeout de segurança: remove contentLoading se iframe não carregar em 15 segundos
  useEffect(() => {
    if (!contentLoading) return;
    const timeout = setTimeout(() => {
      setContentLoading(false);
    }, 15000); // 15 segundos
    return () => clearTimeout(timeout);
  }, [contentLoading]);

  const resumeAfterVisibility = useCallback(async () => {
    if (resumeInFlightRef.current) return;
    resumeInFlightRef.current = true;
    try {
      // 1) Reforça play() nos vídeos (Safari/iOS costuma pausar ao trocar de aba)
      const kick = async (el: HTMLVideoElement | null, opts?: { muted?: boolean }) => {
        if (!el) return;
        try {
          if (typeof opts?.muted === "boolean") el.muted = opts.muted;
          // Re-attach "best effort" (alguns Safari só retomam depois de re-setar srcObject)
          const s = el.srcObject;
          if (s) {
            el.srcObject = null;
            el.srcObject = s;
          }
          await el.play();
        } catch {
          // ignore
        }
      };

      await kick(localVideoRef.current, { muted: true });
      await kick(remoteVideoRef.current, { muted: false });
      if (screenShareActive) await kick(contentScreenVideoRef.current, { muted: true });

      // 2) Se WebAudio foi suspenso ao perder foco, tenta resumir
      try {
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") await ctx.resume();
      } catch {}

      // 3) iOS pode encerrar tracks ao trocar de aba; se a chamada estava "ready", tenta recuperar.
      if (mediaState !== "ready") return;
      const pc = pcRef.current;
      if (!pc) return;

      const isEnded = (t: MediaStreamTrack | null | undefined) => !t || t.readyState === "ended";

      const currentAudio = localStream?.getAudioTracks?.()?.[0] ?? null;
      const currentVideo = localStream?.getVideoTracks?.()?.[0] ?? null;

      // sender de câmera/mic (não confundir com screen share)
      const pickSender = (kind: "audio" | "video") => {
        const senders = pc.getSenders().filter((s) => s?.track?.kind === kind);
        if (kind === "video") return senders.find((s) => s !== screenSenderRef.current) ?? null;
        return senders.find((s) => s !== screenAudioSenderRef.current) ?? null;
      };

      const camSender = pickSender("video");
      const micSender = pickSender("audio");

      const needsNew =
        isEnded(currentAudio) ||
        isEnded(currentVideo) ||
        isEnded((micSender?.track as any) || null) ||
        isEnded((camSender?.track as any) || null);

      if (!needsNew) return;

      try {
        const fresh = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // respeita os toggles atuais
        for (const t of fresh.getAudioTracks()) t.enabled = micOn;
        for (const t of fresh.getVideoTracks()) t.enabled = camOn;

        // atualiza state/UI (preview local)
        setLocalStream(fresh);

        const newAudio = fresh.getAudioTracks?.()?.[0] ?? null;
        const newVideo = fresh.getVideoTracks?.()?.[0] ?? null;

        // troca as tracks no peer connection (sem renegociar, quando suportado)
        if (micSender?.replaceTrack && newAudio) {
          try {
            await micSender.replaceTrack(newAudio);
          } catch {}
        }
        if (camSender?.replaceTrack && newVideo) {
          try {
            await camSender.replaceTrack(newVideo);
          } catch {}
        }

        // fallback: se não há sender por algum motivo, tenta addTrack (melhor esforço)
        const hasAny = pc.getSenders().some((s) => !!s.track);
        if (!hasAny) {
          for (const track of fresh.getTracks()) {
            try {
              pc.addTrack(track, fresh);
            } catch {}
          }
        }

        setMediaError(null);
      } catch (e) {
        // Se o navegador exigir gesto do usuário para reabrir câmera/mic, mostramos a call-to-action.
        setMediaState("failed");
        setMediaError("No iPhone, ao trocar de aba o Safari pode pausar a câmera/mic. Volte para a aba e toque em “Iniciar câmera e microfone”.");
      }
    } finally {
      resumeInFlightRef.current = false;
    }
  }, [camOn, localStream, mediaState, micOn, screenShareActive]);

  // iPhone/Safari: ao voltar para a aba/app, tenta retomar a reprodução e recuperar tracks encerradas.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void resumeAfterVisibility();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [resumeAfterVisibility]);

  // iOS/Safari (PWA) pode bloquear autoplay com áudio; tenta destravar no primeiro toque.
  useEffect(() => {
    const handler = () => {
      const el = remoteVideoRef.current;
      if (!el) return;
      el.muted = false;
      void el.play().catch(() => {});
    };
    window.addEventListener("pointerdown", handler, { passive: true } as any);
    window.addEventListener("touchstart", handler, { passive: true } as any);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler as any);
      window.removeEventListener("touchstart", handler as any);
      window.removeEventListener("keydown", handler as any);
    };
  }, []);

  const send = async (kind: string, payload?: any) => {
    if (!joinInfo) return;
    const isInvite = !user && !!inviteToken;
    if (isInvite) {
      await videoSendCommandInvite({
        appointment_id: joinInfo.sessionId,
        invite_token: inviteToken as string,
        token: joinInfo.token,
        kind,
        payload,
      });
    } else {
      await videoSendCommand({
        appointment_id: joinInfo.sessionId,
        token: joinInfo.token,
        kind,
        payload,
      });
    }
  };

  const postToContentFrame = (msg: any) => {
    try {
      contentFrameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
    } catch {
      // ignore
    }
  };

  // Garante que o iframe (jogo/atividade) sempre receba o estado atual de controle.
  // IMPORTANTÍSSIMO: este hook precisa ficar ANTES de qualquer return condicional (ex.: loader),
  // senão a ordem de hooks muda entre renders e o React quebra (erro minificado #310).
  useEffect(() => {
    // Só faz sentido quando existe algum conteúdo selecionado (iframe montado/para montar).
    if (!contentPath) return;

    postToContentFrame({ type: "SESSION_CONTROL", granted: controlGranted });
    // pequeno retry para cobrir o timing do listener dentro do iframe em iOS/Safari
    const t = window.setTimeout(() => {
      postToContentFrame({ type: "SESSION_CONTROL", granted: controlGranted });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentPath, controlGranted]);

  const unlockContentSfx = () => {
    // "Ping" para destravar WebAudio/SFX no contexto do iframe (jogos/atividades).
    postToContentFrame({ type: "SESSION_UNLOCK_SFX" });
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

  const isInAppBrowser = useMemo(() => {
    try {
      const ua = String(navigator.userAgent || "").toLowerCase();
      // WhatsApp / Instagram / Facebook in-app browsers (iOS/Android)
      return ua.includes("whatsapp") || ua.includes("instagram") || ua.includes("fbav") || ua.includes("fban");
    } catch {
      return false;
    }
  }, []);

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
      if (role === "admin") {
        await send("content_select", { path, title, kind, seed });
      }
    } catch {
      // se falhar, mantém estado local (admin ainda vê)
    }
    setCatalogOpen(false);
  };

  const sendPayment = async (sessions: number, url: string) => {
    if (role !== "admin") return;
    await send("payment_link", { sessions, url });
  };

  const sendPaymentRequest = async (
    sessions: number | null,
    amount: number,
    opts?: { defaultTab?: "pix" | "card"; maxInstallments?: number },
  ) => {
    if (role !== "admin") return;
    await send("payment_request", {
      sessions,
      amount,
      default_tab: opts?.defaultTab ?? null,
      max_installments: typeof opts?.maxInstallments === "number" ? opts?.maxInstallments : null,
    });
  };

  // OBS: geração de link de pagamento é feita fora da transmissão (telas de horários).

  const copyPaymentLink = async () => {
    if (!paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      toast({ title: "Pagamento", description: "Link copiado." });
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = paymentUrl;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast({ title: "Pagamento", description: "Link copiado." });
      } catch {
        toast({ title: "Pagamento", description: "Não foi possível copiar o link.", variant: "destructive" });
      }
    }
  };

  const parseBrlAmount = (raw: string): number => {
    const s = String(raw || "").trim();
    if (!s) return 0;
    // remove moeda/espaços e normaliza 1.234,56 -> 1234.56
    const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
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
      postToContentFrame({ type: "SESSION_CONTROL", granted: next });
    } catch {}
    try {
      await send("control_set", { granted: next });
    } catch {
      // se falhar, reverte
      setControlGranted(!next);
    }
  };

  useEffect(() => {
    if (role !== "user") return;
    if (controlGranted) return;
    if (drawOn) setDrawOn(false);
  }, [role, controlGranted, drawOn]);

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
        const inboundCam = new MediaStream();
        const inboundScreen = new MediaStream();
        setRemoteStream(inbound); // mantém compat (útil para áudio/VAD)
        setRemoteCamStream(inboundCam);
        setRemoteScreenStream(inboundScreen);
        let camVideoTrackId: string | null = null;

        pc.ontrack = (ev) => {
          try {
            // preferir track direto (mais robusto)
            inbound.addTrack(ev.track);
          } catch {}
          // Se chegou qualquer track remoto, consideramos "outro participante presente"
          setRemotePresent(true);
          if (ev.track.kind === "audio") {
            try {
              inboundCam.addTrack(ev.track);
            } catch {}
          }
          if (ev.track.kind === "video") {
            // 1) Preferência: classifica pelo transceiver dedicado de tela (mais confiável).
            if (screenTransceiverRef.current && ev.transceiver === screenTransceiverRef.current) {
              try {
                inboundScreen.addTrack(ev.track);
              } catch {}
              return;
            }

            // 2) Fallback: heurística (1º vídeo = câmera; 2º vídeo = tela)
            if (!camVideoTrackId) {
              camVideoTrackId = ev.track.id;
              try {
                inboundCam.addTrack(ev.track);
              } catch {}
              return;
            }
            if (ev.track.id !== camVideoTrackId) {
              try {
                // garante que o stream de tela tenha só o track atual
                for (const t of inboundScreen.getVideoTracks()) {
                  try { inboundScreen.removeTrack(t); } catch {}
                }
                inboundScreen.addTrack(ev.track);
              } catch {}
              return;
            }
            try {
              inboundCam.addTrack(ev.track);
            } catch {}
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
          if (
            pc.connectionState === "disconnected" ||
            pc.connectionState === "failed" ||
            pc.connectionState === "closed"
          ) {
            setRemotePresent(false);
          }
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
      // Se o backend regenerar o epoch quando o outro participante entra depois,
      // quem já estava aguardando pode ficar "preso" ignorando as novas mensagens e exigindo refresh.
      // Aqui adotamos o epoch novo AUTOMATICAMENTE enquanto ainda não estamos conectados.
      if (typeof msgEpoch === "string" && msgEpoch !== myEpoch) {
        const pc = pcRef.current;
        const connected = pc?.connectionState === "connected";
        if (connected) return;
        // Adota o novo epoch e limpa filas pendentes do epoch antigo (evita misturar)
        epochRef.current = msgEpoch;
        setEpoch(msgEpoch);
        // Importante: alguns backends reiniciam o cursor/IDs quando o epoch muda.
        // Se mantivermos after_id alto, podemos "pular" as novas mensagens e exigir refresh.
        cursorRef.current = 0;
        setCursor(0);
        pendingWebrtcRef.current = [];
        pendingIceRef.current = [];
        pendingOfferRef.current = null;
      } else if (typeof msgEpoch !== "string") {
        // Se vier sem epoch, não bloqueia (compat/backward)
      } else if (msgEpoch !== myEpoch) {
        return;
      }
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
        setPendingOfferAvailable(true);
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
      // Renegociação (ex.: screen share) precisa aceitar novos answers.
      // Só aplica se estamos respondendo a um offer local (estado esperado).
      if (pc.signalingState !== "have-local-offer") return;
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

    // Reconexão: quando o paciente volta, ele pede um novo offer.
    if (m.kind === "webrtc_reconnect" && role === "admin") {
      if (mediaState !== "ready") return;

      const pc = pcRef.current;
      const bad =
        !pc ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.iceConnectionState === "failed";

      if (bad) {
        try {
          try { pcRef.current?.close?.(); } catch {}
          pcRef.current = null;
          peerReadyRef.current = false;
          ensurePeerRef.current = null;
          setRemotePresent(false);
        } catch {}
      }

      await ensurePeer();

      // Garante que a câmera/mic do admin estejam anexadas (sem exigir novo clique)
      const pc2 = pcRef.current;
      if (pc2 && localStream && mediaState === "ready") {
        const hasSenders = pc2.getSenders().some((s) => !!s.track);
        if (!hasSenders) {
          for (const track of localStream.getTracks()) {
            try { pc2.addTrack(track, localStream); } catch {}
          }
        }
      }

      const pc3 = pcRef.current;
      if (pc3) {
        try {
          const offer = await pc3.createOffer();
          await pc3.setLocalDescription(offer);
          await send("webrtc_offer", { sdp: { type: pc3.localDescription?.type, sdp: pc3.localDescription?.sdp } });
        } catch {}
      }
      return;
    }

    // "call_end" não deve derrubar o outro participante.
    // A sessão só "fecha" quando o admin marcar o horário como realizada (status completed).
    if (m.kind === "call_end") {
      setStatusLabel("O outro participante saiu. Você pode entrar novamente quando quiser.");
      setRemotePresent(false);
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

    if (m.kind === "session_paid") {
      setRtcPaymentLocked(false);
      setRtcPaymentMeta(null);
      toast({ title: "Pagamento", description: "Pagamento aprovado. Sessão liberada." });
      return;
    }

    if (m.kind === "payment_link" && role === "user") {
      // Segurança: ignora comandos antigos para não reabrir pagamento ao entrar via link/retornar à chamada.
      const joinedAt = joinedAtMsRef.current || 0;
      const atMs = Date.parse(String((m as any).at || "")) || 0;
      if (joinedAt > 0 && atMs > 0 && atMs + 1500 < joinedAt) return;

      // Evita reabrir automaticamente após refresh/troca de sessão:
      // mensagens antigas podem reaparecer quando o poll reinicia.
      const key = appointmentId ? `rtc_payment_link_seen:${appointmentId}` : "";
      if (key) {
        const last = Number(sessionStorage.getItem(key) || "0");
        if (Number.isFinite(last) && last > 0 && m.id <= last) return;
        sessionStorage.setItem(key, String(m.id));
      }

      const url = m.payload?.url;
      const sessions = m.payload?.sessions;
      if (typeof url === "string" && url.startsWith("http")) {
        setPaymentUrl(url);
        setPaymentSessions(Number.isFinite(Number(sessions)) ? Number(sessions) : null);
        setPaymentDialogOpen(true);
      }
    }

    if (m.kind === "payment_request" && role === "user") {
      // Segurança: ignora comandos antigos para não reabrir pagamento ao entrar via link/retornar à chamada.
      const joinedAt = joinedAtMsRef.current || 0;
      const atMs = Date.parse(String((m as any).at || "")) || 0;
      if (joinedAt > 0 && atMs > 0 && atMs + 1500 < joinedAt) return;

      // Evita reabrir o pagamento automaticamente após refresh:
      // como o poll reinicia com after_id=0, mensagens antigas reaparecem.
      // Aqui deduplicamos por ID (sempre crescente).
      const key = appointmentId ? `rtc_payment_request_seen:${appointmentId}` : "";
      if (key) {
        const last = Number(sessionStorage.getItem(key) || "0");
        if (Number.isFinite(last) && last > 0 && m.id <= last) return;
        sessionStorage.setItem(key, String(m.id));
      }

      const sessions = Number.isFinite(Number(m.payload?.sessions)) ? Number(m.payload?.sessions) : null;
      const amount = Number.isFinite(Number(m.payload?.amount)) ? Number(m.payload?.amount) : 0;
      const defaultTab = m.payload?.default_tab === "card" ? "card" : m.payload?.default_tab === "pix" ? "pix" : undefined;
      const maxInstallments =
        Number.isFinite(Number(m.payload?.max_installments)) && Number(m.payload?.max_installments) >= 1
          ? Math.min(12, Math.max(1, Math.floor(Number(m.payload?.max_installments))))
          : undefined;
      if (amount > 0) {
        // Mantém a transmissão ativa durante o pagamento.
        // Se quiser "silenciar" o paciente durante o pagamento, desativa tracks (não stop).
        try {
          for (const t of localStream?.getAudioTracks?.() || []) t.enabled = false;
          for (const t of localStream?.getVideoTracks?.() || []) t.enabled = false;
          setMicOn(false);
          setCamOn(false);
        } catch {}

        setRtcPaymentLocked(true);
        setRtcPaymentMeta({ sessions, amount, defaultTab, maxInstallments });
        setRtcPaymentOpen(true);
      }
      return;
    }

    if (m.kind === "catalog_open" && role === "user") {
      setCatalogOpen(true);
      return;
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

    if (m.kind === "confetti") {
      // Dispara confete para ambos os participantes
      confettiKeyRef.current += 1;
      setConfettiActive(true);
      playFanfare();
      // Remove o confete após a animação
      setTimeout(() => setConfettiActive(false), 3000);
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

  // Reconexão automática (sem refresh do admin):
  // Quando o paciente entra/volta e o peer não está conectado, ele pede um novo offer.
  useEffect(() => {
    if (!joinInfo || !role) return;
    if (role !== "user") return;
    if (didReconnectRequestRef.current) return;
    const pc = pcRef.current;
    const bad =
      !pc ||
      pc.connectionState === "disconnected" ||
      pc.connectionState === "failed" ||
      pc.connectionState === "closed";
    if (!bad) return;
    didReconnectRequestRef.current = true;
    void send("webrtc_reconnect", { ts: Date.now() }).catch(() => {});
    window.setTimeout(() => {
      didReconnectRequestRef.current = false;
    }, 2500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinInfo?.token, role, mediaState]);

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
        const isInvite = !user && !!inviteToken;
        const res = isInvite
          ? await videoPollInvite({
              appointment_id: joinInfo.sessionId,
              invite_token: inviteToken as string,
              token: joinInfo.token,
              after_id: cursorRef.current,
            })
          : await videoPoll({
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
  }, [joinInfo?.token, role, user, inviteToken]);

  const cleanup = () => {
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    peerReadyRef.current = false;
    pendingWebrtcRef.current = [];
    pendingIceRef.current = [];
    pendingOfferRef.current = null;
    setRemotePresent(false);
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
    screenSenderRef.current = null;
    screenTransceiverRef.current = null;
    screenAudioSenderRef.current = null;
    screenAudioTransceiverRef.current = null;
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
      const display = await (navigator.mediaDevices as any).getDisplayMedia?.({
        video: true,
        // Tenta capturar áudio da aba/página quando o navegador suportar.
        // No Chrome, o usuário escolhe "Compartilhar áudio" no prompt.
        audio: true,
      });
      if (!display) throw new Error("getDisplayMedia não disponível");
      const track: MediaStreamTrack | undefined = display.getVideoTracks?.()?.[0];
      if (!track) throw new Error("Sem vídeo da tela");
      const audioTrack: MediaStreamTrack | undefined = display.getAudioTracks?.()?.[0];
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

      // Envia a tela usando sender dedicado (preferência) => não precisa renegociar.
      // Importante: este sender NÃO pode ser o mesmo da câmera (senão "some" o vídeo ao vivo).
      const pc = pcRef.current;
      if (pc) {
        let sender = screenSenderRef.current;

        // Se ainda não existe sender de tela, cria AGORA (após a câmera já ter sido adicionada),
        // para evitar que addTrack reutilize e depois o replaceTrack substitua a câmera.
        if (!sender) {
          try {
            const tr = pc.addTransceiver("video", { direction: "sendonly" });
            screenTransceiverRef.current = tr;
            sender = tr.sender;
            screenSenderRef.current = sender;
          } catch {
            try {
              // fallback extremo: addTrack (pode exigir renegociação em alguns browsers)
              const s = pc.addTrack(track, display as MediaStream);
              sender = s;
              screenSenderRef.current = s;
            } catch {}
          }
        }

        // Se temos sender, tenta replaceTrack (ideal).
        if (sender?.replaceTrack) {
          try {
            await sender.replaceTrack(track);
          } catch {
            // fallback: renegociação (alguns browsers podem exigir)
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await send("webrtc_offer", { sdp: { type: pc.localDescription?.type, sdp: pc.localDescription?.sdp } });
            } catch {}
          }
        }

        // Áudio da tela (quando o navegador fornecer): envia sem substituir o microfone.
        if (audioTrack) {
          let aSender = screenAudioSenderRef.current;
          if (!aSender) {
            try {
              // cria sender dedicado para áudio da tela
              const trA = pc.addTransceiver("audio", { direction: "sendonly" });
              screenAudioTransceiverRef.current = trA;
              aSender = trA.sender;
              screenAudioSenderRef.current = aSender;
            } catch {
              // fallback: addTrack (pode exigir renegociação em alguns browsers)
              try {
                const sA = pc.addTrack(audioTrack, display as MediaStream);
                aSender = sA;
                screenAudioSenderRef.current = sA;
              } catch {}
            }
          }

          if (aSender?.replaceTrack) {
            try {
              await aSender.replaceTrack(audioTrack);
            } catch {
              // fallback: renegociação (se necessário)
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await send("webrtc_offer", { sdp: { type: pc.localDescription?.type, sdp: pc.localDescription?.sdp } });
              } catch {}
            }
          }
        }
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

    // remove track da tela (mantém transceiver para futuras shares)
    const pc = pcRef.current;
    if (pc && screenSenderRef.current) {
      try {
        if (screenSenderRef.current.replaceTrack) {
          await screenSenderRef.current.replaceTrack(null as any);
        } else {
          pc.removeTrack(screenSenderRef.current);
        }
      } catch {}
    }
    if (pc && screenAudioSenderRef.current) {
      try {
        if (screenAudioSenderRef.current.replaceTrack) {
          await screenAudioSenderRef.current.replaceTrack(null as any);
        } else {
          pc.removeTrack(screenAudioSenderRef.current);
        }
      } catch {}
    }
  };

  const hangup = async () => {
    // Marca para forçar reload quando voltar (limpa sessão WebRTC travada), mas mantém timer via sessionStorage
    if (appointmentId) {
      sessionStorage.setItem(`call_force_reload:${appointmentId}`, String(Date.now()));
    }
    cleanup();
    goBack(false);
  };

  const handleEndSession = async (markCompleted: boolean) => {
    setEndingSession(true);
    if (markCompleted && appointmentId) {
      try {
        if (appRole === "professional") {
          await api.professionalUpdateAppointmentStatus(appointmentId, "completed");
          // Abre o catálogo para o paciente escolher conteúdos (sem precisar de controle).
          try {
            await send("catalog_open", {});
          } catch {}
        } else if (appRole === "admin") {
          await api.adminUpdateAppointmentStatus(appointmentId, "completed");
        }
      } catch (e) {
        const msg = isApiError(e) ? e.message : "Não foi possível marcar como realizada.";
        toast({ title: "Sessão", description: msg, variant: "destructive" });
      }
    }
    setEndingSession(false);
    setEndSessionOpen(false);
    if (appointmentId) {
      sessionStorage.setItem(`call_force_reload:${appointmentId}`, String(Date.now()));
    }
    cleanup();
    goBack(markCompleted);
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
    if (role === "user" && !controlGranted) return;
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
    if (role === "user" && !controlGranted) return;
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
    if (role === "user" && !controlGranted) return;
    if (!drawActiveRef.current) return;
    drawActiveRef.current = false;
    drawLastRef.current = null;
    void sendDraw({ t: "end" }).catch(() => {});
  };

  const startMedia = async () => {
    try {
      // O clique em "iniciar" é o melhor momento para destravar áudio do iframe (SFX de jogos).
      unlockContentSfx();
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

      // Prepara um sender dedicado para screen share ANTES do primeiro offer do admin.
      // (Assim, quando o admin compartilhar, usamos replaceTrack sem renegociação e sem substituir a câmera.)
      if (role === "admin") {
        const pc2 = pcRef.current;
        if (pc2 && !screenSenderRef.current) {
          try {
            const tr = pc2.addTransceiver("video", { direction: "sendonly" });
            screenTransceiverRef.current = tr;
            screenSenderRef.current = tr.sender;
          } catch {
            // ignore
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
          // Prepara sender dedicado para screen share (vídeo + áudio) ANTES do primeiro offer do admin.
          // Assim, quando compartilhar, usamos replaceTrack sem substituir a câmera e sem renegociar.
          if (!screenSenderRef.current) {
            try {
              const tr = pc2.addTransceiver("video", { direction: "sendonly" });
              screenTransceiverRef.current = tr;
              screenSenderRef.current = tr.sender;
            } catch {
              // ignore
            }
          }
          if (!screenAudioSenderRef.current) {
            try {
              const trA = pc2.addTransceiver("audio", { direction: "sendonly" });
              screenAudioTransceiverRef.current = trA;
              screenAudioSenderRef.current = trA.sender;
            } catch {
              // ignore
            }
          }
          const offer = await pc2.createOffer();
          await pc2.setLocalDescription(offer);
        await send("webrtc_offer", { sdp: { type: pc2.localDescription?.type, sdp: pc2.localDescription?.sdp } });
        }
      }

      // Se o usuário já recebeu offer antes, responde agora
      if (role === "user" && pendingOfferRef.current && pcRef.current) {
        const sdp = normalizeSdpInit(pendingOfferRef.current);
        pendingOfferRef.current = null;
        setPendingOfferAvailable(false);
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

      // Dica importante: em navegadores dentro do WhatsApp/Instagram no iPhone, WebRTC/permiteções falham.
      if (isInAppBrowser) {
        setMediaError(
          "Parece que você abriu o link dentro do WhatsApp/Instagram. No iPhone isso costuma bloquear câmera/microfone. Toque em “Abrir no Safari” e tente novamente."
        );
      }

      const full = details ? `${msg} (${name}: ${details})` : `${msg} (${name})`;
      setMediaState("failed");
      setMediaError(full);
      toast({ title: "WebRTC", description: msg, variant: "destructive" });
    }
  };

  const acceptWithoutMedia = async () => {
    try {
      await ensurePeer();
      const pc = pcRef.current;
      const raw = pendingOfferRef.current;
      if (!pc || !raw) {
        toast({ title: "Sessão", description: "Ainda não recebi a conexão do outro participante.", variant: "destructive" });
        return;
      }
      const sdp = normalizeSdpInit(raw);
      pendingOfferRef.current = null;
      setPendingOfferAvailable(false);
      if (!sdp) {
        toast({ title: "Sessão", description: "Oferta inválida. Tente novamente.", variant: "destructive" });
        return;
      }

      // Atenção: isso conecta em modo “somente receber” (sem enviar áudio/vídeo).
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send("webrtc_answer", { sdp: { type: pc.localDescription?.type, sdp: pc.localDescription?.sdp } });

      setMediaState("ready");
      setStatusLabel("Conectado (sem câmera/microfone)");
      toast({
        title: "Conectado",
        description: "Você entrou sem câmera/microfone. Para falar/mostrar vídeo, saia e entre novamente em um navegador compatível.",
      });
    } catch (e) {
      console.error("[WebRTC] acceptWithoutMedia falhou", e);
      toast({ title: "WebRTC", description: "Não foi possível conectar agora.", variant: "destructive" });
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

  // Carregar catálogo quando o controlador (admin/professional) abrir (lazy)
  useEffect(() => {
    if (!catalogOpen) return;
    if (role !== "admin") return;
    if (appRole !== "admin" && appRole !== "professional") return;
    if (catalogLoading) return;
    if (
      activities.length ||
      memGames.length ||
      memGames2.length ||
      phonemeGames.length ||
      audGames.length ||
      hangGames.length ||
      spinGames.length ||
      wordSearchGames.length ||
      cardGames.length ||
      guessImageGames.length
    )
      return;

    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const [a, memClassic, memV2, phon, aud, hang, spin, ws, cards, guess] = await Promise.all([
          (appRole === "admin" ? api.adminListActivities() : api.professionalListActivities()).catch(() => [] as ActivityRow[]),
          (appRole === "admin" ? api.adminListMemoryGames({ variant: "classic" }) : api.professionalListMemoryGames({ variant: "classic" })).catch(
            () => [] as MemoryGameRow[]
          ),
          (appRole === "admin" ? api.adminListMemoryGames({ variant: "v2" }) : api.professionalListMemoryGames({ variant: "v2" })).catch(
            () => [] as MemoryGameRow[]
          ),
          (appRole === "admin" ? api.adminListPhonemeGames() : api.professionalListPhonemeGames()).catch(() => [] as PhonemeGameRow[]),
          (appRole === "admin" ? api.adminListAuditoryGames() : api.professionalListAuditoryGames()).catch(() => [] as AuditoryGameRow[]),
          (appRole === "admin" ? api.adminListHangmanGames() : api.professionalListHangmanGames()).catch(() => [] as HangmanGameRow[]),
          (appRole === "admin" ? api.adminListSpinWheelGames() : api.professionalListSpinWheelGames()).catch(() => [] as SpinWheelGameRow[]),
          (appRole === "admin" ? api.adminListWordSearchGames() : api.professionalListWordSearchGames()).catch(() => [] as WordSearchGameRow[]),
          (appRole === "admin" ? api.adminListCardGames() : api.professionalListCardGames()).catch(() => [] as CardGameRow[]),
          (appRole === "admin" ? api.adminListGuessImageGames() : api.professionalListGuessImageGames()).catch(() => [] as GuessImageGameRow[]),
        ]);
        if (cancelled) return;
        setActivities(a);
        setMemGames(memClassic);
        setMemGames2(memV2);
        setPhonemeGames(phon);
        setAudGames(aud);
        setHangGames(hang);
        setSpinGames(spin);
        setWordSearchGames(ws);
        setCardGames(cards);
        setGuessImageGames(guess);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogOpen, role, appRole]);

  if (authLoading || joining) {
    return (
      <>
        <FullScreenLogoLoader label={statusLabel} />
      </>
    );
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

  const isCarouselActivity = (() => {
    if (!iframeSrc) return false;
    try {
      const url = new URL(iframeSrc, window.location.origin);
      // Atividade (rota /atividades/:id) usa carrossel de mídia; no mobile vertical damos um pouco mais de altura.
      return url.pathname.startsWith("/atividades/");
    } catch {
      return String(iframeSrc).startsWith("/atividades/");
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
        </div>

        <div className="sc-session-grid grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Área principal (conteúdo da sessão) */}
          <div className="sc-session-content order-2 lg:order-1 rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div
              ref={contentAreaRef}
              className={cn(
                "sc-content-area relative w-full",
                isCarouselActivity ? "sc-content-area--carousel" : null,
                // Mobile: mantém mais compacto para caber controles e vídeos
                "h-[55vh] sm:h-[58vh]",
                // Desktop/notebooks: mais alto para não "achatar" e evitar corte em telas 768px de altura
                "lg:h-[76svh] lg:max-h-[860px] lg:min-h-[560px]",
              )}
            >
              {/* Animação de confete */}
              {confettiActive && (
                <div key={confettiKeyRef.current} className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-xl">
                  {Array.from({ length: 100 }).map((_, i) => {
                    const delay = Math.random() * 0.5;
                    const duration = 2.5 + Math.random() * 1;
                    const left = Math.random() * 100;
                    const colors = [
                      "bg-red-500",
                      "bg-blue-500",
                      "bg-yellow-500",
                      "bg-green-500",
                      "bg-purple-500",
                      "bg-pink-500",
                      "bg-orange-500",
                      "bg-indigo-500",
                    ];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const size = 8 + Math.random() * 8;
                    const rotation = Math.random() * 360;
                    
                    return (
                      <div
                        key={i}
                        className={cn(
                          "absolute rounded-sm",
                          color
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${size}px`,
                          height: `${size}px`,
                          animation: `session-confetti-fall ${duration}s ease-out ${delay}s forwards`,
                          transform: `rotate(${rotation}deg)`,
                        }}
                      />
                    );
                  })}
                </div>
              )}

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
                  allow="autoplay"
                  className="absolute inset-0 h-full w-full rounded-xl bg-background"
                  title="Conteúdo da sessão"
                  onLoad={() => {
                    setContentLoading(false);
                    // Após load do iframe, reenviar o estado de controle (mobile pode montar o listener depois).
                    postToContentFrame({ type: "SESSION_CONTROL", granted: controlGranted });
                  }}
                  onError={() => {
                    // Se houver erro no iframe, remove loading após delay
                    setTimeout(() => setContentLoading(false), 1000);
                  }}
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
          <div className="sc-session-cams order-1 lg:order-2">
            {/* Retrato (celular): 2 vídeos lado a lado em cima.
                Paisagem/desktop: vídeos empilhados. (paisagem mobile é forçada via CSS em index.css) */}
            <div
              className={cn(
                "sc-session-cams-inner grid grid-cols-2 gap-2",
                // Desktop: a coluna de vídeos deve acompanhar exatamente a altura da área de atividade (sc-content-area)
                "lg:flex lg:flex-col lg:gap-4 lg:h-[76svh] lg:max-h-[860px] lg:min-h-[560px]"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl border bg-card overflow-hidden transition-[box-shadow,border-color] duration-150 flex flex-col",
                  // Desktop: metade exata da altura disponível (considerando gap-4 => 1rem, divide 0.5rem por card)
                  "lg:h-[calc(50%-0.5rem)] lg:min-h-0",
                  remoteSpeaking ? "border-brand-green shadow-[0_0_0_2px_rgba(34,197,94,0.35)]" : "border-border"
                )}
              >
                <div className="px-3 py-2 text-xs font-semibold text-foreground border-b border-border">
                  {role === "admin" ? "Paciente" : "Fonoaudióloga"}
                </div>
                <div className="relative aspect-[4/3] bg-black lg:aspect-auto lg:flex-1 lg:min-h-0">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  {!remotePresent && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white">
                      <img
                        src={logoImage}
                        alt="Sementes da Fala"
                        className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover mb-3 opacity-95 animate-pulse"
                        draggable={false}
                      />
                      <div className="text-base sm:text-lg font-semibold tracking-wide">
                        {role === "admin" ? "Aguardando paciente" : "Aguardando profissional"}
                        <span className="inline-flex ml-1 align-baseline">
                          <span className="animate-pulse" style={{ animationDelay: "0ms" }}>
                            .
                          </span>
                          <span className="animate-pulse" style={{ animationDelay: "250ms" }}>
                            .
                          </span>
                          <span className="animate-pulse" style={{ animationDelay: "500ms" }}>
                            .
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "rounded-2xl border bg-card overflow-hidden transition-[box-shadow,border-color] duration-150 flex flex-col",
                  // Desktop: metade exata da altura disponível (considerando gap-4 => 1rem, divide 0.5rem por card)
                  "lg:h-[calc(50%-0.5rem)] lg:min-h-0",
                  localSpeaking ? "border-brand-orange shadow-[0_0_0_2px_rgba(249,115,22,0.35)]" : "border-border"
                )}
              >
                <div className="px-3 py-2 text-xs font-semibold text-foreground border-b border-border">
                  {role === "admin" ? "Você (admin)" : "Você"}
                </div>
                <div className="relative aspect-[4/3] bg-black lg:aspect-auto lg:flex-1 lg:min-h-0">
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                  <div className="absolute left-2 bottom-2 z-10">
                    <div className="inline-flex items-center gap-2 rounded-full bg-black/60 text-white px-3 py-1.5 shadow-sm">
                      <Clock3 className="h-4 w-4 opacity-90" />
                      <span className="tabular-nums text-sm font-semibold">{callElapsedLabel}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {role === "admin" && (
            <>
              <Button variant="outline" onClick={() => setCatalogOpen(true)} className="rounded-xl">
                Catálogo (atividades/jogos)
              </Button>
              <Button variant="outline" onClick={() => setPackagesOpen(true)} className="rounded-xl">
                <Package className="h-4 w-4 mr-2" />
                Pacotes
              </Button>
              {appRole === "professional" ? (
                <Button
                  variant="outline"
                  onClick={() => setProCommentOpen(true)}
                  className="rounded-xl border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                  title="Comentário privado (somente admin/profissional veem)"
                >
                  Comentário
                </Button>
              ) : null}
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
              <Button
                variant="outline"
                onClick={() => {
                  // Dispara confete localmente
                  confettiKeyRef.current += 1;
                  setConfettiActive(true);
                  playFanfare();
                  setTimeout(() => setConfettiActive(false), 3000);
                  // Envia evento para sincronizar com o usuário
                  void send("confetti", {});
                }}
                className="rounded-xl border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                title="Soltar confetes!"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Confetes
              </Button>
            </>
          )}

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
            disabled={role === "user" && !controlGranted}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {drawOn && (
            <Button variant="outline" onClick={() => void clearDoodle()} className="rounded-xl" title="Apagar rabiscos">
              <Eraser className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={() => {
              if (role === "admin") {
                setEndSessionOpen(true);
              } else {
                void hangup();
              }
            }}
            className="rounded-xl"
          >
            <PhoneOff />
          </Button>
        </div>
      </div>

      {/* Durante pagamento, mantemos um mini player visível (iOS não pausa áudio/vídeo). */}
      {paymentOverlayActive ? (
        <div className="fixed z-[70] right-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] w-[180px] sm:w-[220px] rounded-2xl overflow-hidden border border-border bg-black/90 shadow-lg">
          <div className="relative w-full aspect-[4/3] bg-black">
            <video
              ref={paymentMiniRemoteRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              autoPlay
            />
            <div className="absolute bottom-2 right-2 w-14 h-14 rounded-xl overflow-hidden border border-white/20 bg-black/60">
              <video
                ref={paymentMiniLocalRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
            </div>
          </div>
          <div className="px-3 py-2 text-[11px] text-white/90">Chamada ativa</div>
        </div>
      ) : null}

      {/* Passo obrigatório: o clique libera as permissões do navegador e entra na chamada. */}
      <BrandedConfirmDialog
        open={!!joinInfo && !!role && !rtcPaymentLocked && mediaState !== "ready"}
        onOpenChange={() => {
          // Obrigatório: não permite fechar manualmente.
        }}
        title="Entrar na sessão"
        description={
          mediaError
            ? mediaError
            : isInAppBrowser
              ? "Se você abriu pelo WhatsApp/Instagram, no iPhone pode não funcionar. Abra no Safari e toque em Participar."
              : "Toque em Participar para entrar na chamada."
        }
        confirmLabel="Participar"
        cancelLabel={role === "user" && mediaState === "failed" && pendingOfferAvailable ? "Entrar sem câmera/mic" : null}
        variant="success"
        hideClose
        disableClose
        confirmDisabled={mediaState === "requesting"}
        confirmClassName="h-12 text-base rounded-2xl"
        onConfirm={() => void startMedia()}
        onCancel={() => void acceptWithoutMedia()}
      />

      {/* Encerrar chamada (admin) */}
      <Dialog open={endSessionOpen} onOpenChange={setEndSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar sessão</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            A sessão foi finalizada? Ambas as opções encerram a chamada.
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEndSessionOpen(false)} disabled={endingSession}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void handleEndSession(false)}
              disabled={endingSession}
            >
              Não finalizada
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => void handleEndSession(true)}
              disabled={endingSession}
            >
              Finalizada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Catálogo (admin): atividades + jogos */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Catálogo (atividades e jogos)</DialogTitle>
          </DialogHeader>

          {catalogLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-6">
              {appRole === "professional" ? (
                <Tabs value={catalogTab} onValueChange={(v) => setCatalogTab(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="meu" className="flex-1">
                      Meu catálogo
                    </TabsTrigger>
                    <TabsTrigger value="compartilhados" className="flex-1">
                      Compartilhados
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
              {/* Seção: Atividades */}
              <div>
                <div className="text-base font-semibold text-foreground mb-3">Atividades</div>
                <div className="space-y-2">
                  {catActivities.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">Nenhuma atividade disponível</div>
                  ) : (
                    catActivities.map((a) => (
                      <button
                        key={`act-${a.id}`}
                        onClick={() => {
                          const path = `/atividades/${a.id}`;
                          if (role === "admin") {
                            setPendingShare({ path, title: a.title, kind: "activity" });
                            setShareConfirmOpen(true);
                          } else {
                            void selectContent(path, a.title, "activity");
                          }
                        }}
                        className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent hover:border-brand-green transition-colors px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-foreground line-clamp-1">{a.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.category || "Atividade"}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Seção: Jogos (com categorias expansíveis) */}
              <div>
                <div className="text-base font-semibold text-foreground mb-3">Jogos</div>
                <Accordion type="multiple" className="w-full space-y-2">
                  {/* Jogo da Memória */}
                  {catMemGames.length > 0 && (
                    <AccordionItem value="memory" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Jogo da Memória ({catMemGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catMemGames.map((g) => (
                            <button
                              key={`mem-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "memory_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "memory_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Memória 2.0 */}
                  {catMemGames2.length > 0 && (
                    <AccordionItem value="memory-v2" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Jogo da Memória 2.0 ({catMemGames2.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catMemGames2.map((g) => (
                            <button
                              key={`mem2-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "memory_game_v2" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "memory_game_v2");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Discriminação de Fonemas */}
                  {catPhonemeGames.length > 0 && (
                    <AccordionItem value="phoneme" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Discriminação de Fonemas ({catPhonemeGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catPhonemeGames.map((g) => (
                            <button
                              key={`phon-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/fonema/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "phoneme_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "phoneme_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Estimulação Auditiva */}
                  {catAudGames.length > 0 && (
                    <AccordionItem value="auditory" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Estimulação Auditiva ({catAudGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catAudGames.map((g) => (
                            <button
                              key={`aud-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/auditivo/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "auditory_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "auditory_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Jogo da Forca */}
                  {catHangGames.length > 0 && (
                    <AccordionItem value="hangman" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Jogo da Forca ({catHangGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catHangGames.map((g) => (
                            <button
                              key={`hang-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/forca/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "hangman_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "hangman_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Roleta */}
                  {catSpinGames.length > 0 && (
                    <AccordionItem value="spin" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Roleta ({catSpinGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catSpinGames.map((g) => (
                            <button
                              key={`spin-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/roleta/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "spin_wheel_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "spin_wheel_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Caça-palavras */}
                  {catWordSearchGames.length > 0 && (
                    <AccordionItem value="wordsearch" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Caça-palavras ({catWordSearchGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catWordSearchGames.map((g) => (
                            <button
                              key={`ws-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/caca-palavras/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "word_search_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "word_search_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Jogo das Cartas */}
                  {catCardGames.length > 0 && (
                    <AccordionItem value="cards" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Jogo das Cartas ({catCardGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catCardGames.map((g) => (
                            <button
                              key={`cards-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/cartas/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "card_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "card_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Acerte a Imagem */}
                  {catGuessImageGames.length > 0 && (
                    <AccordionItem value="guess-image" className="border border-border rounded-xl px-4">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
                        Acerte a Imagem ({catGuessImageGames.length})
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catGuessImageGames.map((g) => (
                            <button
                              key={`guess-${g.id}`}
                              onClick={() => {
                                const path = `/jogos/acerte-imagem/${g.id}`;
                                if (role === "admin") {
                                  setPendingShare({ path, title: g.title, kind: "guess_image_game" });
                                  setShareConfirmOpen(true);
                                } else {
                                  void selectContent(path, g.title, "guess_image_game");
                                }
                              }}
                              className="w-full text-left rounded-lg border border-border bg-muted/30 hover:bg-accent hover:border-brand-green transition-colors px-3 py-2"
                            >
                              <div className="text-sm font-medium text-foreground line-clamp-1">{g.title}</div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Mensagem se não houver jogos */}
                  {catMemGames.length === 0 &&
                    catMemGames2.length === 0 &&
                    catPhonemeGames.length === 0 &&
                    catAudGames.length === 0 &&
                    catHangGames.length === 0 &&
                    catSpinGames.length === 0 &&
                    catWordSearchGames.length === 0 &&
                    catCardGames.length === 0 &&
                    catGuessImageGames.length === 0 && (
                      <div className="text-sm text-muted-foreground py-2">Nenhum jogo disponível</div>
                    )}
                </Accordion>
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
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">Personalizado</div>
                  <div className="text-xs text-muted-foreground">Defina um valor e cobre direto no app.</div>
                </div>
                <Button
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setCustomPayAmount("");
                    setCustomPaySessions("");
                    setCustomPayOpen(true);
                  }}
                >
                  Custom
                </Button>
              </div>
            </div>
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
                      setPendingPayment({ sessions: p.sessions, amount: p.price, url: p.url });
                      setPaymentConfirmOpen(true);
                    }}
                  >
                    Cobrar no app
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Você pode cobrar no app (na chamada) ou gerar um link para abrir a página de pagamento.
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
          description={`Solicitar pagamento (${pendingPayment.sessions} sessões) para o paciente agora?`}
          confirmText="Enviar"
          cancelText="Cancelar"
          onConfirm={() =>
            void sendPaymentRequest(pendingPayment.sessions, pendingPayment.amount).finally(() => {
              setPaymentConfirmOpen(false);
              setPendingPayment(null);
              setPackagesOpen(false);
            })
          }
        />
      ) : null}

      {/* Cobrança personalizada (admin/profissional na transmissão) */}
      <Dialog open={customPayOpen} onOpenChange={setCustomPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cobrança personalizada</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Método sugerido</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={customPayMethod === "pix" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setCustomPayMethod("pix")}
                >
                  Pix
                </Button>
                <Button
                  type="button"
                  variant={customPayMethod === "card" ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setCustomPayMethod("card")}
                >
                  Cartão (parcelado)
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">No cartão, o paciente poderá escolher até 12x (conforme regras do Mercado Pago).</div>
            </div>
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="Ex.: 560,00"
                value={customPayAmount}
                onChange={(e) => setCustomPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sessões (opcional)</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex.: 9"
                value={customPaySessions}
                onChange={(e) => setCustomPaySessions(e.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Se deixar vazio, o pagamento aparecerá apenas como “Pagamento” para o paciente.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setCustomPayOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl"
                onClick={() => {
                  const amount = parseBrlAmount(customPayAmount);
                  const sessionsRaw = customPaySessions.replace(/\D/g, "");
                  const sessionsNum = sessionsRaw ? Number(sessionsRaw) : 0;
                  const sessions = Number.isFinite(sessionsNum) && sessionsNum > 0 ? sessionsNum : null;
                  if (!Number.isFinite(amount) || amount <= 0) {
                    toast({ title: "Pagamento", description: "Informe um valor válido.", variant: "destructive" });
                    return;
                  }
                  void sendPaymentRequest(sessions, amount, { defaultTab: customPayMethod, maxInstallments: 12 }).finally(() => {
                    setCustomPayOpen(false);
                    setPackagesOpen(false);
                  });
                }}
              >
                Enviar cobrança
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagamento embutido (Pix/Cartão) */}
      {appointmentId && rtcPaymentMeta ? (
        <RtcPaymentModal
          open={rtcPaymentOpen}
          onOpenChange={(open) => {
            setRtcPaymentOpen(open);
          }}
          appointmentId={appointmentId}
          sessions={rtcPaymentMeta.sessions}
          amount={rtcPaymentMeta.amount}
          defaultTab={rtcPaymentMeta.defaultTab}
          maxInstallments={rtcPaymentMeta.maxInstallments ?? 12}
          payer={{ name: null, email: user?.email ?? null }}
          onPaid={handleRtcPaid}
        />
      ) : null}

      {/* Comentário do profissional (na transmissão) */}
      <Dialog
        open={proCommentOpen}
        onOpenChange={(open) => {
          setProCommentOpen(open);
          if (!open) {
            setProCommentSaving(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comentário do profissional</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Este comentário é <strong>privado</strong> (o paciente não vê) e aparecerá na página de comentários do paciente abaixo do comentário do admin.
          </div>
          <div className="mt-3 space-y-2">
            <Textarea
              value={proCommentText}
              onChange={(e) => setProCommentText(e.target.value)}
              placeholder="Escreva aqui suas observações..."
              className="min-h-[140px]"
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setProCommentOpen(false)} disabled={proCommentSaving}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl"
                onClick={async () => {
                  if (!appointmentId) return;
                  const text = proCommentText.trim();
                  if (!text) {
                    toast({ title: "Comentário", description: "Escreva um comentário antes de enviar.", variant: "destructive" });
                    return;
                  }
                  setProCommentSaving(true);
                  try {
                    await api.professionalUpsertAppointmentComment(appointmentId, text);
                    toast({ title: "Comentário", description: "Comentário salvo com sucesso." });
                    setProCommentOpen(false);
                  } catch {
                    toast({ title: "Comentário", description: "Não foi possível salvar agora. Tente novamente.", variant: "destructive" });
                  } finally {
                    setProCommentSaving(false);
                  }
                }}
                disabled={proCommentSaving}
              >
                {proCommentSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          <div className="mt-2 text-xs text-muted-foreground">
            Para **não interromper a chamada**, abra o pagamento **aqui dentro** ou copie o link para usar em outro dispositivo.
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setPaymentDialogOpen(false)}>
              Agora não
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => void copyPaymentLink()}>
              Copiar link
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => {
                if (paymentUrl) {
                  // registra intenção (para aparecer no admin/perfil), mas não bloqueia o fluxo
                  if (paymentSessions) {
                    void api.userRegisterPurchaseIntent({ package_sessions: paymentSessions }).catch(() => {});
                  }
                  // Abre dentro da própria chamada (não derruba WebRTC)
                  setPaymentIframeOpen(true);
                }
                setPaymentDialogOpen(false);
              }}
            >
              Abrir aqui (Mercado Pago)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagamento embedado (user): mantém chamada ativa */}
      <Dialog
        open={paymentIframeOpen}
        onOpenChange={(open) => {
          setPaymentIframeOpen(open);
        }}
      >
        <DialogContent
          className={cn(
            // Mobile/tablet: fullscreen para não “sair da chamada” e ficar usável no PWA
            "flex flex-col w-[100vw] h-[100svh] max-w-none rounded-none p-0 overflow-hidden",
            // Desktop: modal central tradicional
            "sm:max-w-4xl sm:w-[95vw] sm:h-[85vh] sm:rounded-2xl",
          )}
        >
          <DialogHeader className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-2">
            <DialogTitle>Pagamento (Mercado Pago)</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-3 text-xs text-muted-foreground">
            Se não carregar (bloqueio do navegador), use <strong>Copiar link</strong> e abra em outro dispositivo/aba.
          </div>
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => void copyPaymentLink()}>
              Copiar link
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                if (paymentUrl) window.open(paymentUrl, "_blank", "noopener,noreferrer");
              }}
            >
              Abrir em nova aba
            </Button>
            <Button className="rounded-xl ml-auto" onClick={() => setPaymentIframeOpen(false)}>
              Voltar para a chamada
            </Button>
          </div>
          <div className="flex-1 min-h-0 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            {paymentUrl ? (
              <iframe
                src={paymentUrl}
                title="Pagamento Mercado Pago"
                className="w-full h-full bg-background"
                // sandbox permissivo (ainda seguro por isolamento do iframe)
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                allow="payment *; clipboard-write"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Link indisponível.
              </div>
            )}
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
            draft={reportDraft}
            showMinimize
            onMinimize={(draft) => {
              setReportDraft(draft);
              reportMinimizedRef.current = true;
            }}
            onOpenChange={(open) => {
              setReportOpen(open);
              if (!open) {
                // Se fechou por "Minimizar", mantém o rascunho para reabrir depois.
                if (reportMinimizedRef.current) {
                  reportMinimizedRef.current = false;
                  return;
                }
                // Qualquer outro fechamento descarta rascunho.
                setReportDraft(null);
              }
            }}
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

