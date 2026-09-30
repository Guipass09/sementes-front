import { useCallback, useEffect, useState } from "react";
import { Check, UserRoundCheck, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { patientListLinkRequests, patientRespondLinkRequest, type PatientLinkRequestRow } from "@/lib/laravel-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
};

export default function PatientLinkRequests({ open, onOpenChange, onResolved }: Props): JSX.Element {
  const { toast } = useToast();
  const location = useLocation();
  const isPreview = location.pathname.startsWith("/preview-");
  const [requests, setRequests] = useState<PatientLinkRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (isPreview) {
      setRequests([]);
      setError(false);
      return;
    }
    setLoading(true);
    try {
      setRequests(await patientListLinkRequests());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [isPreview]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const respond = async (id: number, decision: "accepted" | "declined") => {
    setBusyId(id);
    try {
      await patientRespondLinkRequest(id, decision);
      setRequests((current) => current.filter((item) => item.id !== id));
      onResolved();
      toast({
        title: decision === "accepted" ? "Acompanhamento autorizado" : "Solicitação recusada",
        description: decision === "accepted" ? "A profissional já pode acompanhar suas atividades e agendar sessões." : undefined,
      });
    } catch {
      toast({ title: "Não foi possível responder", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCheck className="h-5 w-5 text-brand-green" /> Solicitações de acompanhamento
          </DialogTitle>
          <DialogDescription>Decida quais profissionais podem acompanhar você na plataforma.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-sm text-muted-foreground">Carregando solicitações...</p>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 py-5">
            <p className="text-sm text-destructive">Não foi possível carregar as solicitações.</p>
            <Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button>
          </div>
        ) : requests.length === 0 ? (
          <p className="border-t border-border py-6 text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {requests.map((item) => (
              <div key={item.id} className="space-y-4 py-5">
                <div>
                  <p className="font-semibold text-foreground">{item.professional_name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Solicitou acesso ao seu acompanhamento.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ao autorizar, poderá consultar suas atividades e relatórios e agendar sessões com você.</p>
                  {item.created_at && (
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" disabled={busyId === item.id} onClick={() => void respond(item.id, "declined")}>
                    <X className="mr-2 h-4 w-4" /> Recusar
                  </Button>
                  <Button disabled={busyId === item.id} onClick={() => void respond(item.id, "accepted")}>
                    <Check className="mr-2 h-4 w-4" /> Autorizar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
