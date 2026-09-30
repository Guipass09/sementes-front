import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getTodayYMD } from "@/lib/session-alert";
import { isApiError, professionalCreateAppointments, professionalListPatients, type ProfessionalPatientRow } from "@/lib/laravel-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export default function ProfessionalAppointmentDialog({ open, onOpenChange, onCreated }: Props): JSX.Element {
  const { toast } = useToast();
  const [patients, setPatients] = useState<ProfessionalPatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<"scheduled" | "evaluation">("scheduled");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    void professionalListPatients()
      .then((rows) => { if (active) setPatients(rows); })
      .catch(() => { if (active) toast({ title: "Não foi possível carregar pacientes", variant: "destructive" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, toast]);

  const submit = async () => {
    const count = Number(quantity);
    if (!patientId || !date || !time || !Number.isInteger(count) || count < 1 || count > 12) {
      toast({ title: "Revise os dados do agendamento", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await professionalCreateAppointments({
        user_id: Number(patientId),
        session_date: date,
        session_time: time,
        session_kind: kind,
        quantity: count,
      });
      toast({ title: count === 1 ? "Sessão agendada" : `${count} sessões agendadas` });
      setPatientId("");
      setDate("");
      setTime("");
      setKind("scheduled");
      setQuantity("1");
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast({
        title: "Não foi possível agendar",
        description: isApiError(error) ? error.data?.message || "Confira se o horário está livre." : "Tente novamente.",
        variant: "destructive",
      });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar sessão</DialogTitle>
          <DialogDescription>Selecione um paciente vinculado e o horário do atendimento.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando pacientes...</p>
        ) : patients.length === 0 ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Nenhum paciente autorizado para agendamento.</p>
            <Button asChild variant="outline"><Link to="/profissional/pacientes" onClick={() => onOpenChange(false)}>Ir para Pacientes</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-session-patient">Paciente</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="new-session-patient"><SelectValue placeholder="Selecionar paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={String(patient.id)}>{patient.child_name?.trim() || patient.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-session-date">Data</Label>
                <Input id="new-session-date" type="date" min={getTodayYMD(Date.now())} value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-session-time">Horário</Label>
                <Input id="new-session-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-session-kind">Tipo</Label>
                <Select value={kind} onValueChange={(value) => setKind(value as "scheduled" | "evaluation")}>
                  <SelectTrigger id="new-session-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Sessão</SelectItem>
                    <SelectItem value="evaluation">Avaliação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-session-quantity">Semanas consecutivas</Label>
                <Input id="new-session-quantity" type="number" min={1} max={12} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={() => void submit()} disabled={saving}>{saving ? "Salvando..." : "Agendar"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
