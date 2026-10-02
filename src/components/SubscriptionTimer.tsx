import { useEffect, useMemo, useState } from "react";
import type { ProfessionalSubscription } from "@/lib/laravel-api";
import { Clock, AlertTriangle } from "lucide-react";

export function useSubscriptionRemaining(subscription?: ProfessionalSubscription) {
  const anchor = useMemo(() => ({ time: performance.now(), remaining: subscription?.expires_at ? Date.parse(subscription.expires_at) - Date.parse(subscription.server_now) : null }), [subscription?.expires_at, subscription?.server_now]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(timer); }, []);
  void tick;
  return anchor.remaining === null ? null : Math.max(0, Math.ceil((anchor.remaining - (performance.now() - anchor.time)) / 1000));
}

export default function SubscriptionTimer({ subscription }: { subscription?: ProfessionalSubscription }) {
  const seconds = useSubscriptionRemaining(subscription);
  if (!subscription || subscription.status === "clinic" || subscription.status === "not_applicable") return null;
  if (subscription.status === "legacy") return <span>Acesso anterior preservado</span>;
  if (subscription.status === "suspended") return <span>Assinatura desativada</span>;
  if (seconds === null) return <span>Aguardando ativação</span>;
  if (!seconds || subscription.status === "expired") return <span className="font-medium text-red-700">Assinatura vencida</span>;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const urgent = seconds <= 86400;
  const soon = seconds <= 7 * 86400;
  const Icon = soon ? AlertTriangle : Clock;
  return <span className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-2 py-1.5 text-xs ${urgent ? "border-red-200 bg-red-50 text-red-800" : soon ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
    <span className="inline-flex items-center gap-1 font-semibold"><Icon size={14} aria-hidden="true" />{urgent ? "Vence em menos de 24h" : soon ? "Vence em até 7 dias" : "Assinatura ativa"}</span>
    <span className="whitespace-nowrap tabular-nums">{days}d {String(hours).padStart(2, "0")}h {String(minutes).padStart(2, "0")}m {String(seconds % 60).padStart(2, "0")}s</span>
    <span>Até {new Date(subscription.expires_at!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} (Brasília)</span>
  </span>;
}
