import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { cn } from "@/lib/utils";
import type { JoinSessionMeta } from "@/lib/laravel-api";
import { getTodayYMD, parseLocalDateTime } from "@/lib/session-alert";

export function JoinSessionButton(props: {
  meta?: JoinSessionMeta | null;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  nowMs?: number;
  className?: string;
  onClick?: () => void;
}) {
  const meta = props.meta;
  // Se o backend marcou como não-agendada, nunca mostra (evita aparecer em "cancelada/realizada").
  if (meta?.reason === "not_active") return null;
  const hasLocalClock =
    typeof props.nowMs === "number" && !!props.date && !!props.time;

  // Regras do botão (UI):
  // - aparece apenas no dia da sessão
  // - pisca 10 min antes até o horário
  // - fica clicável de 10 min antes até 20 min após
  // Obs: quando `date/time/nowMs` forem fornecidos, usamos o relógio local (mesma lógica do pontinho laranja).
  const local = (() => {
    if (!hasLocalClock) return null;
    const startMs = parseLocalDateTime(props.date!, props.time!);
    if (startMs === null) return { visible: false, enabled: false, blink: false, reason: "invalid_time" as const };

    const enabledFrom = startMs - 10 * 60_000;
    // A partir de 10 min antes, fica disponível até o admin marcar como realizada (sem expirar por tempo).
    // Sessão 00:00 => enabledFrom cai no dia anterior (23:50), então visibilidade precisa considerar a janela.
    const visible = props.nowMs! >= enabledFrom;
    const enabled = props.nowMs! >= enabledFrom;
    const blink = props.nowMs! >= enabledFrom && props.nowMs! <= startMs;
    const reason = enabled ? null : "too_early";
    return { visible, enabled, blink, reason };
  })();

  // Visibilidade: usa relógio local para o "dia de hoje",
  // mas respeita casos onde o backend explicitamente não tem datetime.
  if (meta?.reason === "missing_datetime") return null;
  const visible = local ? local.visible : !!meta?.visible;
  if (!visible) return null;

  const label = (meta?.label || "Entrar na sessão").trim();
  const enabled = local ? local.enabled : !!meta?.enabled;
  const blink = local ? local.blink : !!meta?.blink;
  const reason = local ? local.reason : meta?.reason;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!enabled}
      onClick={props.onClick}
      className={cn(
        "relative h-auto px-3 py-2 rounded-xl",
        "flex flex-col items-center justify-center gap-1",
        "min-w-[112px]",
        blink ? "animate-pulse ring-2 ring-brand-orange/60" : "",
        !enabled ? "opacity-60" : "",
        props.className
      )}
      title={!enabled && reason ? String(reason) : undefined}
    >
      {blink && (
        <span
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-brand-orange animate-pulse shadow-sm"
          aria-hidden="true"
        />
      )}
      <img
        src={(meta?.logo_url || logoImage) as string}
        alt="Logo"
        className="h-6 w-6 object-contain"
        loading="lazy"
      />
      <span className="text-[11px] leading-tight font-semibold text-center">{label}</span>
    </Button>
  );
}

