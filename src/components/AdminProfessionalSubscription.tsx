import { useEffect, useState } from "react";
import { Clock, History, ShieldCheck } from "lucide-react";
import { adminSubscription, isApiError, type SubscriptionResponse, type ProfessionalSubscription } from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import SubscriptionTimer from "./SubscriptionTimer";
import BrandedConfirmDialog from "./BrandedConfirmDialog";

const actions: Record<string, string> = { activate: "Período ativado", extend: "Prazo ampliado", suspend: "Acesso desativado", resume: "Acesso reativado" };
const plans: Record<string, string> = { monthly: "Mensal", quarterly: "Trimestral", annual: "Anual", custom: "Personalizado" };
const units: Record<string, string> = { hour: "hora(s)", day: "dia(s)", week: "semana(s)", month: "mês(es)", year: "ano(s)" };
export default function AdminProfessionalSubscription({ id, onChange }: { id: number; onChange: (value: ProfessionalSubscription) => void }) {
  const [data, setData] = useState<SubscriptionResponse>();
  const [plan, setPlan] = useState("monthly");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("day");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  useEffect(() => { let current = true; setData(undefined); adminSubscription(id).then(value => { if (current) setData(value); }).catch(() => { if (current) setError("Não foi possível carregar a assinatura. Reabra o perfil para tentar novamente."); }); return () => { current = false; }; }, [id]);
  async function save(action: string, confirmed = false) {
    if (!confirmed && (action === "suspend" || (action === "activate" && data?.subscription.expires_at))) { setConfirmation(action); return; }
    setConfirmation(null);
    setBusy(true); setError("");
    try { const result = await adminSubscription(id, action === "suspend" || action === "resume" ? { action } : { action, plan, quantity, unit }); setData(result); onChange(result.subscription); }
    catch (e) { setError(isApiError(e) ? String(e.data?.message ?? "Não foi possível salvar.") : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const invalidPeriod = plan === "custom" && (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000);
  return <section className="space-y-4 border-y border-border py-5" aria-label="Assinatura profissional">
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Assinatura individual</h4><span className="text-sm font-medium text-primary"><SubscriptionTimer subscription={data?.subscription} /></span></div>
    {!data && !error && <p role="status">Carregando assinatura...</p>}
    {data && <>
      {data.subscription.period && <p className="text-sm font-medium">{plans[data.subscription.period.plan] ?? "Personalizado"} · {data.subscription.period.quantity} {units[data.subscription.period.unit]}</p>}
      <p className="flex items-center gap-2 text-sm"><Clock size={16} /> {data.subscription.expires_at ? `Validade: ${new Date(data.subscription.expires_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília)` : "Nenhum prazo definido"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">Plano<select className={selectClass} value={plan} onChange={e => setPlan(e.target.value)} disabled={busy}><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option><option value="custom">Personalizado</option></select></label>
        {plan === "custom" && <><label className="grid gap-1 text-sm">Duração<input className={selectClass} type="number" min={1} max={10000} value={quantity} onChange={e => setQuantity(Number(e.target.value))} disabled={busy} /></label><label className="grid gap-1 text-sm">Unidade<select className={selectClass} value={unit} onChange={e => setUnit(e.target.value)} disabled={busy}><option value="hour">Horas</option><option value="day">Dias</option><option value="week">Semanas</option><option value="month">Meses</option><option value="year">Anos</option></select></label></>}
      </div>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || invalidPeriod} onClick={() => void save("activate")}>{busy ? "Salvando..." : "Ativar novo período"}</Button><Button type="button" variant="outline" disabled={busy || invalidPeriod} onClick={() => void save("extend")}>Adicionar prazo</Button>{data.subscription.status === "suspended" ? <Button type="button" variant="outline" disabled={busy} onClick={() => void save("resume")}>Reativar acesso</Button> : <Button type="button" variant="outline" disabled={busy} onClick={() => void save("suspend")}>Desativar acesso</Button>}</div>
      <p className="text-xs text-muted-foreground">Adicionar prazo preserva o tempo restante. Ao vencer ou desativar, o acesso é bloqueado, sem excluir pacientes, atividades ou documentos. A desativação não pausa a validade.</p>
      <details><summary className="cursor-pointer text-sm font-medium"><History className="mr-2 inline" size={16} />Histórico de alterações</summary><ul className="mt-3 space-y-2 text-xs text-muted-foreground">{data.events.length === 0 && <li>Nenhuma alteração registrada.</li>}{data.events.map(event => <li key={event.id}>{actions[event.action] ?? event.action} · {new Date(event.created_at.replace(" ", "T") + (event.created_at.includes("Z") ? "" : "Z")).toLocaleString("pt-BR")} · Admin #{event.admin_id}</li>)}</ul></details>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <BrandedConfirmDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }} title={confirmation === "suspend" ? "Desativar assinatura?" : "Substituir período atual?"} description={confirmation === "suspend" ? "O acesso será bloqueado, sem excluir dados. A validade continuará contando." : "O novo prazo começa agora e substitui o tempo restante. Para preservar esse tempo, use Adicionar prazo."} confirmLabel="Confirmar alteração" onConfirm={() => { if (confirmation) void save(confirmation, true); }} />
  </section>;
}
