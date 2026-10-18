import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";
import {
  FinanceEntryDialog,
  FinancePaymentDialog,
  FinanceSettingsDialog,
} from "@/features/finance/FinanceDialogs";
import {
  canUsePersonalFinance,
  financeCsv,
  financeDate,
  financeToday,
  formatMoney,
  PAYMENT_METHODS,
  type FinanceData,
  type FinanceEntry,
  type FinanceEntryUpdate,
} from "@/features/finance/finance";

function apiMessage(error: unknown) {
  if (api.isApiError(error)) {
    const fields = error.data?.errors
      ? Object.values(error.data.errors).flat()
      : [];
    return String(
      fields[0] ??
        error.data?.message ??
        "Não foi possível salvar. Tente novamente.",
    );
  }
  return "Não foi possível conectar ao financeiro. Tente novamente.";
}

export default function ProfessionalFinance() {
  const { user } = useAuth();
  if (!canUsePersonalFinance(user))
    return <Navigate to="/profissional" replace />;
  return <FinanceWorkspace key={user!.id} userId={user!.id} />;
}

function FinanceWorkspace({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => financeToday().slice(0, 7));
  const [tab, setTab] = useState<"income" | "expense">("income");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [showValues, setShowValues] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entryDialog, setEntryDialog] = useState<{
    kind: FinanceEntry["kind"];
    entry: FinanceEntry | null;
  } | null>(null);
  const [payment, setPayment] = useState<FinanceEntry | null>(null);
  const [confirmation, setConfirmation] = useState<{
    entry: FinanceEntry;
    action: "reopen" | "void" | "restore";
  } | null>(null);
  const query = useQuery({
    queryKey: ["personal-finance", userId, month],
    queryFn: () => api.professionalFinance(month),
    staleTime: 15_000,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["personal-finance", userId] });
  const onError = (error: unknown) =>
    toast({
      title: "Confira o lançamento",
      description: apiMessage(error),
      variant: "destructive",
    });
  const settingsMutation = useMutation({
    mutationFn: api.professionalSaveFinanceSettings,
    onSuccess: () => {
      void invalidate();
      toast({ title: "Configurações salvas" });
    },
    onError,
  });
  const createMutation = useMutation({
    mutationFn: api.professionalCreateFinanceEntry,
    onSuccess: () => {
      void invalidate();
      toast({ title: "Lançamento registrado" });
    },
    onError,
  });
  const entryMutation = useMutation({
    mutationFn: ({
      entry,
      value,
    }: {
      entry: FinanceEntry;
      value: FinanceEntryUpdate;
    }) => api.professionalUpdateFinanceEntry(entry.id, value),
    onSuccess: () => {
      void invalidate();
      toast({ title: "Lançamento atualizado" });
    },
    onError: (error) => {
      onError(error);
      if (api.isApiError(error) && error.status === 409) void invalidate();
    },
  });
  const syncMutation = useMutation({
    mutationFn: api.professionalSyncFinance,
    onSuccess: () => {
      void invalidate();
      toast({ title: "Sessões atualizadas" });
    },
    onError,
  });
  const data = query.data;
  const today = financeToday();
  const filtered = useMemo(
    () =>
      (data?.entries ?? []).filter((entry) => {
        if (entry.kind !== tab) return false;
        if (
          status === "overdue"
            ? !(entry.status === "pending" && entry.due_on < today)
            : status !== "all" && entry.status !== status
        )
          return false;
        const term = search.trim().toLocaleLowerCase("pt-BR");
        return (
          !term ||
          [entry.description, entry.patient_name, entry.notes].some((value) =>
            value?.toLocaleLowerCase("pt-BR").includes(term),
          )
        );
      }),
    [data?.entries, tab, status, search, today],
  );
  useEffect(() => setPage(1), [month, tab, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
  const money = (cents: number) => (showValues ? formatMoney(cents) : "R$ --");

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([financeCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `financeiro-${month}-${tab === "income" ? "recebimentos" : "despesas"}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Wallet size={24} className="text-brand-green-dark" />
            Financeiro
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus atendimentos, recebimentos e despesas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowValues((value) => !value)}
            title={showValues ? "Ocultar valores" : "Mostrar valores"}
            aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
          >
            {showValues ? <EyeOff size={17} /> : <Eye size={17} />}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            disabled={!data}
          >
            <Settings2 size={16} className="mr-2" />
            Valores e regras
          </Button>
        </div>
      </header>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="finance-month" className="text-sm font-medium">
            Período
          </label>
          <Input
            id="finance-month"
            type="month"
            min="2000-01"
            max="2100-12"
            value={month}
            onChange={(e) => {
              if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))
                setMonth(e.target.value);
            }}
            className="w-44"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            data?.settings ? syncMutation.mutate() : void query.refetch()
          }
          disabled={query.isFetching || syncMutation.isPending}
        >
          <RefreshCw
            size={15}
            className={`mr-2 ${query.isFetching || syncMutation.isPending ? "animate-spin" : ""}`}
          />
          Atualizar sessões
        </Button>
      </div>

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="border-y border-border py-8">
          <h2 className="font-semibold">Não foi possível abrir o financeiro</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {apiMessage(query.error)}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        data && (
          <>
            {!data.settings && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
                <div>
                  <h2 className="font-semibold">
                    Qual é o valor da sua sessão?
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Defina seu valor padrão para começar o controle dos
                    atendimentos.
                  </p>
                </div>
                <Button onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={16} className="mr-2" />
                  Definir valor da sessão
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Recebido no mês",
                  value: data.summary.received_cents,
                  icon: ArrowDownLeft,
                  color: "text-brand-green-dark",
                },
                {
                  label: "A receber até o mês",
                  value: data.summary.pending_income_cents,
                  icon: CalendarDays,
                  color: "text-amber-700 dark:text-amber-400",
                },
                {
                  label: "Despesas pagas",
                  value: data.summary.paid_expense_cents,
                  icon: ArrowUpRight,
                  color: "text-rose-600 dark:text-rose-400",
                },
                {
                  label: "Saldo do mês",
                  value: data.summary.balance_cents,
                  icon: Wallet,
                  color: "text-foreground",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="min-w-0 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {item.label}
                    </p>
                    <item.icon
                      size={17}
                      className={`flex-none ${item.color}`}
                    />
                  </div>
                  <p
                    className={`mt-3 break-words text-lg font-semibold tabular-nums sm:text-xl ${item.color}`}
                  >
                    {money(item.value)}
                  </p>
                </div>
              ))}
            </div>
            <div className="my-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>
                <strong className="text-foreground">
                  {data.summary.session_count}
                </strong>{" "}
                sessões realizadas
              </span>
              <span>
                Registrado em sessões:{" "}
                <strong className="text-foreground">
                  {money(data.summary.session_revenue_cents)}
                </strong>
              </span>
              <span>
                Em atraso:{" "}
                <strong
                  className={
                    data.summary.overdue_cents
                      ? "text-destructive"
                      : "text-foreground"
                  }
                >
                  {money(data.summary.overdue_cents)}
                </strong>
              </span>
            </div>
            {!!data.summary.upcoming_count && (
              <p className="mb-5 text-xs text-muted-foreground">
                Previsão na agenda: {data.summary.upcoming_count} sessões,{" "}
                {money(data.summary.forecast_cents)} pelo valor padrão. Ainda
                não contabilizado como recebimento.
              </p>
            )}
            {!!data.summary.pending_expense_cents && (
              <p className="mb-5 text-xs text-muted-foreground">
                Despesas a pagar até o mês:{" "}
                {money(data.summary.pending_expense_cents)}.
              </p>
            )}
            <CashFlow data={data.cash_flow} showValues={showValues} />

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as "income" | "expense")}
              className="border-t border-border pt-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="income">
                    <ArrowDownLeft size={15} className="mr-1.5" />
                    Recebimentos
                  </TabsTrigger>
                  <TabsTrigger value="expense">
                    <ArrowUpRight size={15} className="mr-1.5" />
                    Despesas
                  </TabsTrigger>
                </TabsList>
                <Button
                  onClick={() => setEntryDialog({ kind: tab, entry: null })}
                >
                  <Plus size={16} className="mr-1.5" />
                  {tab === "income" ? "Novo recebimento" : "Nova despesa"}
                </Button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search
                    size={17}
                    className="absolute left-3 top-3 text-muted-foreground"
                  />
                  <Input
                    aria-label="Buscar lançamentos"
                    placeholder="Buscar paciente ou lançamento..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Situação dos lançamentos"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todas as situações</option>
                  <option value="pending">Pendentes</option>
                  <option value="overdue">Em atraso</option>
                  <option value="paid">
                    {tab === "income" ? "Recebidos" : "Pagos"}
                  </option>
                  <option value="void">Cancelados</option>
                </select>
                <Button
                  variant="outline"
                  onClick={download}
                  disabled={!filtered.length}
                >
                  <Download size={16} className="mr-2" />
                  CSV
                </Button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Lançamentos do período e pendências anteriores até o mês
                selecionado.
              </p>
              {["income", "expense"].map((kind) => (
                <TabsContent key={kind} value={kind} className="mt-0">
                  {!visible.length ? (
                    <div className="border-y border-border py-10 text-center text-sm text-muted-foreground">
                      Nenhum lançamento encontrado para este período e filtro.
                    </div>
                  ) : (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[740px] text-left text-sm">
                          <thead className="border-y border-border bg-muted/30 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-3 font-medium">
                                Lançamento
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Paciente
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Vencimento
                              </th>
                              <th className="px-3 py-3 text-right font-medium">
                                Valor
                              </th>
                              <th className="px-3 py-3 font-medium">
                                Situação
                              </th>
                              <th className="w-12">
                                <span className="sr-only">Ações</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-b border-border/70 hover:bg-muted/20"
                              >
                                <td className="max-w-[250px] px-3 py-4">
                                  <p className="break-words font-medium">
                                    {entry.description}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {financeDate(entry.occurred_on)}
                                    {entry.source === "session"
                                      ? " · Sessão"
                                      : ""}
                                  </p>
                                  {entry.needs_review && <ReviewNotice />}
                                </td>
                                <td className="max-w-[160px] break-words px-3 py-4 text-muted-foreground">
                                  {entry.patient_name || "-"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-muted-foreground">
                                  {financeDate(entry.due_on)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums">
                                  {money(entry.amount_cents)}
                                </td>
                                <td className="px-3 py-4">
                                  <EntryStatus entry={entry} today={today} />
                                  {entry.paid_on && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {financeDate(entry.paid_on)} ·{" "}
                                      {
                                        PAYMENT_METHODS.find(
                                          (method) =>
                                            method.value ===
                                            entry.payment_method,
                                        )?.label
                                      }
                                    </p>
                                  )}
                                </td>
                                <td className="pr-2">
                                  <EntryActions
                                    entry={entry}
                                    busy={entryMutation.isPending}
                                    onPay={() => setPayment(entry)}
                                    onEdit={() =>
                                      setEntryDialog({
                                        kind: entry.kind,
                                        entry,
                                      })
                                    }
                                    onAction={(action) =>
                                      setConfirmation({ entry, action })
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="divide-y divide-border border-y border-border md:hidden">
                        {visible.map((entry) => (
                          <div key={entry.id} className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold">
                                  {entry.description}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {entry.patient_name ||
                                    financeDate(entry.occurred_on)}
                                </p>
                              </div>
                              <EntryActions
                                entry={entry}
                                busy={entryMutation.isPending}
                                onPay={() => setPayment(entry)}
                                onEdit={() =>
                                  setEntryDialog({ kind: entry.kind, entry })
                                }
                                onAction={(action) =>
                                  setConfirmation({ entry, action })
                                }
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <strong className="tabular-nums">
                                {money(entry.amount_cents)}
                              </strong>
                              <EntryStatus entry={entry} today={today} />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Vencimento: {financeDate(entry.due_on)}
                              {entry.paid_on
                                ? " · Pago em " + financeDate(entry.paid_on)
                                : ""}
                            </p>
                            {entry.needs_review && <ReviewNotice />}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>
              ))}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{filtered.length} lançamento(s)</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span>
                    {currentPage} de {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === pages}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </Tabs>
          </>
        )
      )}
      {settingsOpen && data && (
        <FinanceSettingsDialog
          settings={data.settings}
          busy={settingsMutation.isPending}
          onClose={() => setSettingsOpen(false)}
          onSave={(value) => settingsMutation.mutateAsync(value)}
        />
      )}
      {entryDialog && data && (
        <FinanceEntryDialog
          kind={entryDialog.kind}
          entry={entryDialog.entry}
          patients={data.patients}
          busy={createMutation.isPending || entryMutation.isPending}
          onClose={() => setEntryDialog(null)}
          onCreate={(value) => createMutation.mutateAsync(value)}
          onEdit={(entry, value) => entryMutation.mutateAsync({ entry, value })}
        />
      )}
      {payment && (
        <FinancePaymentDialog
          entry={payment}
          busy={entryMutation.isPending}
          onClose={() => setPayment(null)}
          onPay={(value) =>
            entryMutation.mutateAsync({ entry: payment, value })
          }
        />
      )}
      <BrandedConfirmDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !entryMutation.isPending) setConfirmation(null);
        }}
        title={
          confirmation?.action === "void"
            ? "Cancelar lançamento?"
            : confirmation?.action === "reopen"
              ? "Reabrir lançamento?"
              : "Restaurar lançamento?"
        }
        description={
          confirmation?.action === "reopen"
            ? "A confirmação de pagamento será desfeita no controle financeiro. Isso não realiza estorno bancário."
            : confirmation?.action === "void"
              ? "O lançamento continuará no histórico como cancelado e não comporá o valor a receber ou pagar."
              : "O lançamento voltará à situação pendente."
        }
        confirmDisabled={entryMutation.isPending}
        onConfirm={() => {
          if (confirmation)
            void entryMutation
              .mutateAsync({
                entry: confirmation.entry,
                value: {
                  action: confirmation.action,
                  version: confirmation.entry.version,
                },
              })
              .then(() => setConfirmation(null))
              .catch(() => {});
        }}
      />
    </div>
  );
}

function EntryStatus({ entry, today }: { entry: FinanceEntry; today: string }) {
  const overdue = entry.status === "pending" && entry.due_on < today;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${entry.status === "paid" ? "text-brand-green-dark" : overdue ? "text-destructive" : "text-muted-foreground"}`}
    >
      {entry.status === "paid" ? (
        <Check size={13} />
      ) : overdue ? (
        <AlertCircle size={13} />
      ) : null}
      {entry.status === "paid"
        ? entry.kind === "income"
          ? "Recebido"
          : "Pago"
        : entry.status === "void"
          ? "Cancelado"
          : overdue
            ? "Em atraso"
            : "Pendente"}
    </span>
  );
}

function EntryActions({
  entry,
  busy,
  onPay,
  onEdit,
  onAction,
}: {
  entry: FinanceEntry;
  busy: boolean;
  onPay: () => void;
  onEdit: () => void;
  onAction: (action: "void" | "reopen" | "restore") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-none"
          aria-label={"Ações de " + entry.description}
          disabled={busy}
        >
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entry.status === "pending" && (
          <>
            <DropdownMenuItem onClick={onPay}>
              <Check size={15} className="mr-2" />
              {entry.kind === "income"
                ? "Confirmar recebimento"
                : "Confirmar pagamento"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil size={15} className="mr-2" />
              Editar lançamento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("void")}>
              <X size={15} className="mr-2" />
              Cancelar lançamento
            </DropdownMenuItem>
          </>
        )}
        {entry.status === "paid" && (
          <DropdownMenuItem onClick={() => onAction("reopen")}>
            <RotateCcw size={15} className="mr-2" />
            Reabrir lançamento
          </DropdownMenuItem>
        )}
        {entry.status === "void" && (
          <DropdownMenuItem onClick={() => onAction("restore")}>
            <RotateCcw size={15} className="mr-2" />
            Restaurar lançamento
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReviewNotice() {
  return (
    <p className="mt-2 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
      <AlertCircle size={13} className="mt-0.5 flex-none" />A sessão vinculada
      mudou. Confira este lançamento.
    </p>
  );
}

function CashFlow({
  data,
  showValues,
}: {
  data: FinanceData["cash_flow"];
  showValues: boolean;
}) {
  return (
    <section
      aria-labelledby="finance-cash-flow"
      className="mb-6 border-t border-border pt-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="finance-cash-flow"
          className="text-sm font-semibold text-foreground"
        >
          Fluxo de caixa
        </h2>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-green-dark" />
            Recebido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand-orange" />
            Despesas pagas
          </span>
        </div>
      </div>
      {!showValues ? (
        <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Valores ocultos
        </p>
      ) : (
        <figure className="h-44 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tickFormatter={(month) =>
                  new Intl.DateTimeFormat("pt-BR", {
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(month + "-01T12:00:00Z"))
                }
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={60}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                  }).format(Number(value) / 100)
                }
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip
                formatter={(value, name) => [
                  formatMoney(Number(value)),
                  name === "income_cents" ? "Recebido" : "Despesas pagas",
                ]}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: 6,
                }}
              />
              <Bar
                dataKey="income_cents"
                fill="hsl(var(--brand-green-dark))"
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
              />
              <Bar
                dataKey="expense_cents"
                fill="hsl(var(--brand-orange))"
                radius={[3, 3, 0, 0]}
                maxBarSize={26}
              />
            </BarChart>
          </ResponsiveContainer>
          <figcaption className="sr-only">
            {data
              .map(
                (item) =>
                  `${item.month}: recebido ${formatMoney(item.income_cents)}, despesas pagas ${formatMoney(item.expense_cents)}`,
              )
              .join(". ")}
          </figcaption>
        </figure>
      )}
    </section>
  );
}
