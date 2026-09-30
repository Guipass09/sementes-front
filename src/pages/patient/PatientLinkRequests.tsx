import { useCallback, useEffect, useState } from "react";
import { UserRoundCheck, Check, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { patientListLinkRequests, patientRespondLinkRequest, type PatientLinkRequestRow } from "@/lib/laravel-api";

export default function PatientLinkRequests(): JSX.Element {
  const { toast } = useToast();
  const location = useLocation();
  const isPreview = location.pathname.startsWith("/preview-");
  const [requests, setRequests] = useState<PatientLinkRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (isPreview) {
      setLoading(false);
      return;
    }
    try {
      setRequests(await patientListLinkRequests());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isPreview]);

  useEffect(() => { void refresh(); }, [refresh]);

  const respond = async (id: number, decision: "accepted" | "declined") => {
    setBusyId(id);
    try {
      await patientRespondLinkRequest(id, decision);
      setRequests((current) => current.filter((item) => item.id !== id));
      toast({
        title: decision === "accepted" ? "Acompanhamento autorizado" : "Solicitação recusada",
        description: decision === "accepted" ? "A profissional já pode acompanhar suas atividades e agendar sessões." : undefined,
      });
    } catch {
      toast({ title: "Não foi possível responder", description: "Atualize a página e tente novamente.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-display font-bold text-foreground">
          <UserRoundCheck className="h-6 w-6 text-brand-green" /> Solicitações
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Profissionais aguardando sua autorização para acompanhar você.</p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">Não foi possível carregar as solicitações.</p>
          <Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="border-t border-border py-10 text-sm text-muted-foreground">Nenhuma solicitação pendente.</div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {requests.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{item.professional_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">Solicitou acesso ao seu acompanhamento na plataforma.</p>
                <p className="mt-1 text-sm text-muted-foreground">Ao autorizar, poderá consultar suas atividades e relatórios e agendar sessões com você.</p>
                {item.created_at && <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" disabled={busyId === item.id} onClick={() => void respond(item.id, "declined")}
                  className="flex-1 sm:flex-none">
                  <X className="mr-2 h-4 w-4" /> Recusar
                </Button>
                <Button disabled={busyId === item.id} onClick={() => void respond(item.id, "accepted")}
                  className="flex-1 sm:flex-none">
                  <Check className="mr-2 h-4 w-4" /> Autorizar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
