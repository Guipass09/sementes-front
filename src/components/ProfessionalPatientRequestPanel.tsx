import { useCallback, useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  isApiError,
  professionalCancelPatientRequest,
  professionalListPatientRequests,
  professionalLookupPatient,
  professionalRequestPatient,
  type PatientLinkRequestRow,
} from "@/lib/laravel-api";

type LookupResult = Awaited<ReturnType<typeof professionalLookupPatient>>;

export default function ProfessionalPatientRequestPanel(): JSX.Element {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [requests, setRequests] = useState<PatientLinkRequestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try { setRequests(await professionalListPatientRequests()); } catch { /* The patient list remains usable. */ }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const search = async () => {
    const normalized = email.trim();
    if (!normalized) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await professionalLookupPatient(normalized));
    } catch (error) {
      toast({
        title: "Paciente não encontrado",
        description: isApiError(error) ? error.data?.message || "Confira o e-mail informado." : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!result || result.linked || result.request_status === "pending") return;
    setBusy(true);
    try {
      await professionalRequestPatient(result.email);
      await refresh();
      setOpen(false);
      setEmail("");
      setResult(null);
      toast({ title: "Solicitação enviada", description: "O paciente poderá autorizar o vínculo na conta dele." });
    } catch (error) {
      toast({
        title: "Não foi possível enviar",
        description: isApiError(error) ? error.data?.message || "Tente novamente." : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setBusy(false); }
  };

  const cancel = async (id: number) => {
    setCancelingId(id);
    try {
      await professionalCancelPatientRequest(id);
      setRequests((current) => current.filter((request) => request.id !== id));
      toast({ title: "Solicitação cancelada" });
    } catch {
      toast({ title: "Não foi possível cancelar", variant: "destructive" });
    } finally { setCancelingId(null); }
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Pacientes autorizados aparecem na lista abaixo.</p>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Adicionar paciente
        </Button>
      </div>

      {requests.length > 0 && (
        <section className="mb-7 border-y border-border py-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">Solicitações enviadas</h2>
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{request.patient_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{request.status === "pending" ? "Aguardando autorização" : "Recusada"}</span>
                </div>
                {request.status === "pending" && (
                  <Button variant="ghost" size="sm" disabled={cancelingId === request.id}
                    onClick={() => void cancel(request.id)} title="Cancelar solicitação">
                    <X className="mr-1 h-4 w-4" /> Cancelar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={open} onOpenChange={(value) => {
        setOpen(value);
        if (!value) { setResult(null); setEmail(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar paciente</DialogTitle>
            <DialogDescription>Busque pelo e-mail da conta do paciente. O vínculo depende da autorização dele.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient-lookup-email">E-mail do paciente ou responsável</Label>
              <div className="flex gap-2">
                <Input id="patient-lookup-email" type="email" autoComplete="email" value={email}
                  onChange={(event) => { setEmail(event.target.value); setResult(null); }}
                  onKeyDown={(event) => { if (event.key === "Enter") void search(); }}
                  placeholder="email@exemplo.com" />
                <Button type="button" variant="outline" onClick={() => void search()} disabled={busy || !email.trim()} title="Buscar paciente">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {result && (
              <div className="border-t border-border pt-4">
                <p className="font-semibold text-foreground">{result.patient_name}</p>
                <p className="text-sm text-muted-foreground">{result.email}</p>
                {result.linked ? (
                  <p className="mt-3 text-sm text-brand-green">Este paciente já está vinculado a você.</p>
                ) : result.request_status === "pending" ? (
                  <p className="mt-3 text-sm text-muted-foreground">Solicitação aguardando resposta.</p>
                ) : result.request_status === "declined" ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-muted-foreground">A solicitação anterior foi recusada. Um novo pedido só pode ser enviado após sete dias.</p>
                    <Button onClick={() => void send()} disabled={busy} className="w-full">Enviar nova solicitação</Button>
                  </div>
                ) : (
                  <Button onClick={() => void send()} disabled={busy} className="mt-4 w-full">Enviar solicitação</Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
