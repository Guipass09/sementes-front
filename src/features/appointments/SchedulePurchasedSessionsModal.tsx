import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getWeeklySlotAvailability, paymentsStatus, schedulePurchasedSessions } from "@/lib/laravel-api";

type DayId = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

const weekDays: Array<{ id: DayId; label: string; shortLabel: string }> = [
  { id: "monday", label: "Segunda-feira", shortLabel: "Seg" },
  { id: "tuesday", label: "Terça-feira", shortLabel: "Ter" },
  { id: "wednesday", label: "Quarta-feira", shortLabel: "Qua" },
  { id: "thursday", label: "Quinta-feira", shortLabel: "Qui" },
  { id: "friday", label: "Sexta-feira", shortLabel: "Sex" },
];

const availableTimes = [
  "08:00",
  "09:00",
  "09:40",
  "10:20",
  "11:00",
  "11:40",
  "13:00",
  "13:40",
  "14:20",
  "15:00",
  "15:40",
  "16:20",
  "17:00",
  "17:40",
  "18:20",
  "19:00",
  "19:40",
  "20:20",
];

export type SaleMeta = {
  notificationId: string;
  patient: { id: number; name: string };
  sessions: number;
  amount?: number;
  paymentId?: number;
  paymentStatus?: string | null;
  professionals?: Array<{ id: number; name: string }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleMeta | null;
  role: "admin" | "professional";
  onScheduled?: () => void;
};

export default function SchedulePurchasedSessionsModal({ open, onOpenChange, sale, role, onScheduled }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [paymentOk, setPaymentOk] = useState<boolean>(false);
  const [quantity, setQuantity] = useState<string>(String(sale?.sessions ?? ""));
  const [startDate, setStartDate] = useState<string>("");
  const [selectedSlots, setSelectedSlots] = useState<Array<{ dayId: DayId; time: string }>>([]);
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [unavailableByDay, setUnavailableByDay] = useState<Record<string, string[]>>({});

  const professionalOptions = useMemo(() => sale?.professionals ?? [], [sale?.professionals]);
  const canPickProfessional = role === "admin";
  const isAwaitingPayment = useMemo(() => {
    const st = String(sale?.paymentStatus || "");
    return !!sale?.paymentId && st && st !== "approved";
  }, [sale?.paymentId, sale?.paymentStatus]);

  useEffect(() => {
    if (!open) return;
    setQuantity(String(sale?.sessions ?? ""));
    setPaymentOk(String(sale?.paymentStatus || "") === "approved");
  }, [open, sale?.sessions, sale?.paymentStatus]);

  // Carrega horários indisponíveis (já agendados)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getWeeklySlotAvailability();
        if (!cancelled) setUnavailableByDay(res.unavailable || {});
      } catch {
        if (!cancelled) setUnavailableByDay({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const isUnavailable = useMemo(() => {
    return (dayId: DayId, time: string) => {
      const arr = unavailableByDay?.[dayId] ?? [];
      return arr.includes(time);
    };
  }, [unavailableByDay]);

  // Se a notificação veio de Pix gerado, aguarda confirmação antes de liberar o "Agendar todas"
  useEffect(() => {
    if (!open) return;
    if (!sale?.paymentId) return;
    if (!isAwaitingPayment) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void paymentsStatus({ payment_id: sale.paymentId as number })
        .then((s) => {
          if (cancelled) return;
          if (s.paid || String(s.status || "") === "approved") {
            setPaymentOk(true);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, sale?.paymentId, isAwaitingPayment]);

  const toggleSlot = (dayId: DayId, time: string) => {
    const key = `${dayId}-${time}`;
    const exists = selectedSlots.some((s) => `${s.dayId}-${s.time}` === key);
    if (exists) {
      setSelectedSlots((prev) => prev.filter((s) => `${s.dayId}-${s.time}` !== key));
    } else {
      // mantém simples: até 3 combinações (igual ao paciente)
      if (selectedSlots.length >= 3) return;
      if (isUnavailable(dayId, time)) return;
      setSelectedSlots((prev) => [...prev, { dayId, time }]);
    }
  };

  const handleSubmit = async () => {
    if (!sale) return;
    const q = Number(String(quantity || "").replace(/\D/g, ""));
    if (!Number.isFinite(q) || q < 1) {
      toast({ title: "Agendamento", description: "Informe a quantidade de sessões.", variant: "destructive" });
      return;
    }
    if (selectedSlots.length < 1) {
      toast({ title: "Agendamento", description: "Selecione pelo menos 1 dia e horário.", variant: "destructive" });
      return;
    }
    if (canPickProfessional && professionalOptions.length > 0 && !professionalId) {
      toast({ title: "Agendamento", description: "Selecione o profissional.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const res = await schedulePurchasedSessions({
        patient_id: sale.patient.id,
        quantity: q,
        start_date: startDate ? startDate : null,
        slots: selectedSlots,
        professional_user_id: canPickProfessional ? professionalId : null,
      });

      if ("success" in (res as any) && (res as any).success) {
        toast({ title: "Agendamento", description: "Sessões agendadas com sucesso." });
        onOpenChange(false);
        onScheduled?.();
      } else {
        const msg = String((res as any)?.message || "Não foi possível agendar tudo.");
        toast({ title: "Agendamento", description: msg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Agendamento", description: "Erro ao agendar. Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar sessões compradas</DialogTitle>
        </DialogHeader>

        {sale ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/10 p-4">
              <div className="text-sm text-muted-foreground">Paciente</div>
              <div className="text-base font-semibold text-foreground">{sale.patient.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Compra: <strong>{sale.sessions}</strong> sessões{typeof sale.amount === "number" ? ` • R$ ${sale.amount.toFixed(2)}` : ""}
              </div>
              {isAwaitingPayment ? (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                  Pix gerado e aguardando pagamento. O agendamento será liberado automaticamente quando o pagamento for confirmado.
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade de sessões</Label>
                <Input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Ex.: 9" />
              </div>
              <div className="space-y-1.5">
                <Label>Data inicial (opcional)</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              {canPickProfessional ? (
                <div className="space-y-1.5">
                  <Label>Profissional</Label>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={professionalId ? String(professionalId) : ""}
                    onChange={(e) => setProfessionalId(e.target.value ? Number(e.target.value) : null)}
                    disabled={professionalOptions.length === 0}
                  >
                    <option value="">{professionalOptions.length ? "Selecione" : "Nenhum profissional vinculado"}</option>
                    {professionalOptions.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-sm font-semibold text-foreground">Dias e horários (até 3 combinações)</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                {weekDays.map((d) => (
                  <div key={d.id} className="rounded-xl border border-border bg-muted/10 p-2">
                    <div className="text-sm font-semibold text-foreground text-center pb-2">{d.shortLabel}</div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                      {availableTimes.map((t) => {
                        const active = selectedSlots.some((s) => s.dayId === d.id && s.time === t);
                        const blocked = !active && selectedSlots.length >= 3;
                        const unavailable = !active && isUnavailable(d.id, t);
                        const disabled = blocked || unavailable;
                        return (
                          <button
                            key={`${d.id}-${t}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleSlot(d.id, t)}
                            className={cn(
                              "w-full px-2 py-2 rounded-lg text-xs font-medium transition-colors border",
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : unavailable
                                ? "bg-destructive/10 text-destructive border-destructive/20 cursor-not-allowed"
                                : blocked
                                ? "bg-muted/20 text-muted-foreground border-border cursor-not-allowed"
                                : "bg-background text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30",
                            )}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {selectedSlots.length ? (
                <div className="mt-3 text-sm text-muted-foreground">
                  Selecionados:{" "}
                  {selectedSlots.map((s) => `${weekDays.find((d) => d.id === s.dayId)?.shortLabel} ${s.time}`).join(" • ")}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
                Agora não
              </Button>
              <Button className="rounded-xl" onClick={() => void handleSubmit()} disabled={busy || (isAwaitingPayment && !paymentOk)}>
                {busy ? "Agendando..." : "Agendar todas"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhuma venda pendente.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

