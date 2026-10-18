import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  FINANCE_CATEGORIES,
  PAYMENT_METHODS,
  financeToday,
  formatMoney,
  moneyInput,
  moneyInputToCents,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryUpdate,
  type FinanceSettings,
} from "./finance";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function FinanceSettingsDialog({
  settings,
  busy,
  onClose,
  onSave,
}: {
  settings: FinanceSettings | null;
  busy: boolean;
  onClose: () => void;
  onSave: (
    value: Omit<FinanceSettings, "version"> & { version?: number },
  ) => Promise<unknown>;
}) {
  const [fee, setFee] = useState(
    settings ? moneyInput(settings.session_fee_cents) : "",
  );
  const [days, setDays] = useState(settings?.payment_term_days ?? 0);
  const [autoRecord, setAutoRecord] = useState(settings?.auto_record ?? true);
  const [start, setStart] = useState(settings?.record_from ?? financeToday());
  const [error, setError] = useState("");
  const [version] = useState(settings?.version);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cents = moneyInputToCents(fee);
    if (!cents) {
      setError("Informe um valor de sessão válido, como 200,00.");
      return;
    }
    try {
      await onSave({
        session_fee_cents: cents,
        payment_term_days: days,
        auto_record: autoRecord,
        record_from: start,
        version,
      });
      onClose();
    } catch {
      /* The page displays the API error. */
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Valores e recebimentos</DialogTitle>
          <DialogDescription>
            Defina o valor padrão dos seus atendimentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="finance-fee">Valor por sessão (R$)</Label>
              <Input
                id="finance-fee"
                inputMode="decimal"
                placeholder="200,00"
                value={fee}
                maxLength={16}
                onChange={(e) => setFee(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="finance-term">Prazo de pagamento (dias)</Label>
              <Input
                id="finance-term"
                type="number"
                min={0}
                max={90}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-start">Início do controle</Label>
            <Input
              id="finance-start"
              type="date"
              min="2000-01-01"
              max={financeToday()}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={!!settings}
              required
            />
            <p className="text-xs text-muted-foreground">
              As sessões concluídas desde essa data serão registradas com o
              valor padrão. Sessões anteriores ficam fora do controle.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-y border-border py-4">
            <Label htmlFor="finance-auto" className="leading-relaxed">
              Registrar sessões concluídas automaticamente
            </Label>
            <Switch
              id="finance-auto"
              checked={autoRecord}
              onCheckedChange={setAutoRecord}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Alterar o valor padrão preserva os lançamentos existentes. O
            recebimento é confirmado por você, após o pagamento.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar configurações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FinanceEntryDialog({
  kind,
  entry,
  patients,
  busy,
  onClose,
  onCreate,
  onEdit,
}: {
  kind: FinanceEntry["kind"];
  entry: FinanceEntry | null;
  patients: { id: number; name: string }[];
  busy: boolean;
  onClose: () => void;
  onCreate: (value: FinanceEntryInput) => Promise<unknown>;
  onEdit: (entry: FinanceEntry, value: FinanceEntryUpdate) => Promise<unknown>;
}) {
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(
    entry ? moneyInput(entry.amount_cents) : "",
  );
  const [occurred, setOccurred] = useState(
    entry?.occurred_on ?? financeToday(),
  );
  const [due, setDue] = useState(entry?.due_on ?? financeToday());
  const [patient, setPatient] = useState(
    entry?.patient_id ? String(entry.patient_id) : "",
  );
  const [category, setCategory] = useState(
    entry?.category ?? (kind === "income" ? "sessions" : "other"),
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [paid, setPaid] = useState(false);
  const [paidOn, setPaidOn] = useState(financeToday());
  const [method, setMethod] = useState("pix");
  const [error, setError] = useState("");
  const [version] = useState(entry?.version);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cents = moneyInputToCents(amount);
    if (!cents) {
      setError("Informe um valor válido, como 150,00.");
      return;
    }
    if (!description.trim()) {
      setError("Informe a descrição do lançamento.");
      return;
    }
    try {
      if (entry)
        await onEdit(entry, {
          action: "edit",
          version: version!,
          amount_cents: cents,
          due_on: due,
          description: description.trim(),
          notes,
        });
      else
        await onCreate({
          kind,
          description: description.trim(),
          amount_cents: cents,
          occurred_on: occurred,
          due_on: due,
          patient_id: patient ? Number(patient) : null,
          category,
          notes,
          paid,
          paid_on: paid ? paidOn : null,
          payment_method: paid ? method : null,
        });
      onClose();
    } catch {
      /* The page displays the API error. */
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entry
              ? "Editar lançamento"
              : kind === "income"
                ? "Novo recebimento"
                : "Nova despesa"}
          </DialogTitle>
          <DialogDescription>
            {entry?.source === "session"
              ? "Lançamento vinculado a uma sessão concluída."
              : "Registre os dados do lançamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entry-description">Descrição</Label>
            <Input
              id="entry-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={180}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-amount">Valor (R$)</Label>
              <Input
                id="entry-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                maxLength={16}
                placeholder="150,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-category">Categoria</Label>
              <select
                id="entry-category"
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={!!entry}
              >
                {FINANCE_CATEGORIES.filter(
                  (item) =>
                    kind === "expense" ||
                    ["sessions", "other"].includes(item.value),
                ).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-date">Data do lançamento</Label>
              <Input
                id="entry-date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={occurred}
                onChange={(e) => setOccurred(e.target.value)}
                disabled={!!entry}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-due">Vencimento</Label>
              <Input
                id="entry-due"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                required
              />
            </div>
          </div>
          {kind === "income" && (
            <div className="space-y-2">
              <Label htmlFor="entry-patient">Paciente</Label>
              <select
                id="entry-patient"
                className={selectClass}
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                disabled={!!entry}
              >
                <option value="">Sem paciente vinculado</option>
                {patients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!entry && (
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {kind === "income" ? "Já recebido" : "Já pago"}
            </label>
          )}
          {paid && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entry-paid-on">Data do pagamento</Label>
                <Input
                  id="entry-paid-on"
                  type="date"
                  max={financeToday()}
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-method">Forma de pagamento</Label>
                <select
                  id="entry-method"
                  className={selectClass}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="entry-notes">Observações</Label>
            <Textarea
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function FinancePaymentDialog({
  entry,
  busy,
  onClose,
  onPay,
}: {
  entry: FinanceEntry;
  busy: boolean;
  onClose: () => void;
  onPay: (value: FinanceEntryUpdate) => Promise<unknown>;
}) {
  const [date, setDate] = useState(financeToday());
  const [method, setMethod] = useState("pix");
  const [version] = useState(entry.version);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await onPay({
        action: "pay",
        version,
        paid_on: date,
        payment_method: method,
      });
      onClose();
    } catch {
      /* The page displays the API error. */
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry.kind === "income"
              ? "Confirmar recebimento"
              : "Confirmar pagamento"}
          </DialogTitle>
          <DialogDescription>{entry.description}</DialogDescription>
        </DialogHeader>
        <p className="text-2xl font-semibold text-foreground">
          {formatMoney(entry.amount_cents)}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payment-date">Data do pagamento</Label>
            <Input
              id="payment-date"
              type="date"
              max={financeToday()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-method">Forma de pagamento</Label>
            <select
              id="payment-method"
              className={selectClass}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Confirmando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
