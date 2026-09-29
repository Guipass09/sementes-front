import { useEffect, useState } from "react";
import { Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";

const monthName = (month: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const money = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

export default function AdminProfessionalEarnings({ professionalId }: { professionalId: number }): JSX.Element {
  const { toast } = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<{ earliest_year: number; months: api.ProfessionalEarningsMonth[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.adminGetProfessionalEarnings(professionalId, year)
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) toast({ title: "Não foi possível carregar os ganhos", variant: "destructive" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [professionalId, year]);

  const markPaid = async (month: string) => {
    if (!window.confirm(`Confirmar pagamento de ${monthName(month)}?`)) return;
    setPaying(month);
    try {
      const updated = await api.adminMarkProfessionalEarningsPaid(professionalId, month);
      setData((previous) => previous ? { ...previous, months: previous.months.map((item) => item.month === month ? updated : item) } : previous);
      toast({ title: "Pagamento registrado" });
    } catch {
      toast({ title: "Não foi possível registrar o pagamento", variant: "destructive" });
    } finally {
      setPaying(null);
    }
  };

  return <section className="border-t border-border pt-5" aria-label="Ganhos mensais">
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-semibold"><Wallet size={18} /> Ganhos mensais</h3>
      <select aria-label="Ano dos ganhos" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-9 rounded-md border border-border bg-background px-3 text-sm">
        {Array.from({ length: Math.max(1, new Date().getFullYear() - (data?.earliest_year ?? year) + 1) }, (_, index) => new Date().getFullYear() - index).map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </div>
    {loading ? <p className="mt-3 text-sm text-muted-foreground">Carregando...</p> : !data?.months.length ? <p className="mt-3 text-sm text-muted-foreground">Sem meses neste período.</p> :
      <div className="mt-3 divide-y divide-border">
        {data.months.map((item) => <div key={item.month} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <div>
            <p className="font-medium capitalize">{monthName(item.month)}</p>
            <p className="text-xs text-muted-foreground">Sessões: {item.counts.scheduled} x {money(item.rates.scheduled)} = {money(item.amounts.scheduled)}</p>
            <p className="text-xs text-muted-foreground">Avaliações: {item.counts.evaluation} x {money(item.rates.evaluation)} = {money(item.amounts.evaluation)}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{money(item.total)}</p>
            {item.paid_at ? <p className="flex items-center justify-end gap-1 text-xs text-green-700"><Check size={13} /> Pago em {new Date(item.paid_at).toLocaleDateString("pt-BR")}</p> : !item.closed ? <p className="text-xs text-muted-foreground">Em andamento</p> : item.total > 0 ?
              <Button size="sm" variant="outline" disabled={paying === item.month} onClick={() => void markPaid(item.month)} className="mt-1">Marcar como pago</Button> : <p className="text-xs text-muted-foreground">Sem valor devido</p>}
          </div>
        </div>)}
      </div>}
  </section>;
}
