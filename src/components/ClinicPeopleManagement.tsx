import { useEffect, useMemo, useState } from "react";
import { BriefcaseMedical, Link2, Mail, Phone, Search, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import * as api from "@/lib/laravel-api";
import type { ClinicPatientRow, ClinicProfessionalRow } from "@/lib/laravel-api";

type ClinicTab = "professionals" | "patients";

type ProfessionalFormState = {
  name: string;
  email: string;
  phone: string;
  professional_age: string;
  professional_crfa: string;
  professional_registration: string;
  password: string;
  password_confirmation: string;
};

type PatientFormState = {
  responsible_name: string;
  child_name: string;
  child_birthdate: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  professional_ids: number[];
};

const PROFESSIONAL_LIMIT = 30;

const emptyProfessionalForm = (): ProfessionalFormState => ({
  name: "",
  email: "",
  phone: "",
  professional_age: "",
  professional_crfa: "",
  professional_registration: "",
  password: "",
  password_confirmation: "",
});

const emptyPatientForm = (): PatientFormState => ({
  responsible_name: "",
  child_name: "",
  child_birthdate: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
  professional_ids: [],
});

const formatYmd = (ymd?: string | null) => {
  if (!ymd) return "";
  const dt = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
};

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function ClinicPeopleManagement(): JSX.Element {
  const { toast } = useToast();
  const [tab, setTab] = useState<ClinicTab>("professionals");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [professionals, setProfessionals] = useState<ClinicProfessionalRow[]>([]);
  const [patients, setPatients] = useState<ClinicPatientRow[]>([]);
  const [professionalLimit, setProfessionalLimit] = useState(PROFESSIONAL_LIMIT);
  const [createProfessionalOpen, setCreateProfessionalOpen] = useState(false);
  const [attachProfessionalOpen, setAttachProfessionalOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [savingProfessional, setSavingProfessional] = useState(false);
  const [attachingProfessionalId, setAttachingProfessionalId] = useState<number | null>(null);
  const [savingPatient, setSavingPatient] = useState(false);
  const [professionalForm, setProfessionalForm] = useState<ProfessionalFormState>(emptyProfessionalForm);
  const [patientForm, setPatientForm] = useState<PatientFormState>(emptyPatientForm);
  const [availableProfessionals, setAvailableProfessionals] = useState<ClinicProfessionalRow[]>([]);
  const [availableProfessionalsLoading, setAvailableProfessionalsLoading] = useState(false);
  const [availableProfessionalsSearch, setAvailableProfessionalsSearch] = useState("");

  const professionalCount = professionals.length;
  const remainingProfessionalSlots = Math.max(0, professionalLimit - professionalCount);
  const limitReached = professionalCount >= professionalLimit;

  const loadClinicData = async () => {
    setLoading(true);
    try {
      const [professionalRes, patientRows] = await Promise.all([
        api.clinicListProfessionals(),
        api.clinicListPatients(),
      ]);
      setProfessionals(professionalRes.data ?? []);
      setProfessionalLimit(professionalRes.limit ?? PROFESSIONAL_LIMIT);
      setPatients(patientRows);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar a gestão da clínica",
        description: error?.data?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClinicData();
  }, []);

  const filteredProfessionals = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return professionals;
    return professionals.filter((professional) =>
      [
        professional.name,
        professional.email,
        professional.phone ?? "",
        professional.professional_crfa ?? "",
        professional.professional_registration ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [professionals, search]);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [
        patient.child_name ?? "",
        patient.responsible_name ?? "",
        patient.email,
        patient.phone ?? "",
        patient.assigned_professionals.map((professional) => professional.name).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [patients, search]);

  const openProfessionalModal = () => {
    if (limitReached) {
      toast({
        title: "Limite atingido",
        description: "Sua clínica já chegou ao máximo de 30 terapeutas cadastrados.",
        variant: "destructive",
      });
      return;
    }
    setProfessionalForm(emptyProfessionalForm());
    setCreateProfessionalOpen(true);
  };

  const openPatientModal = () => {
    setPatientForm(emptyPatientForm());
    setCreatePatientOpen(true);
  };

  const openAttachProfessionalModal = async () => {
    if (limitReached) {
      toast({
        title: "Limite atingido",
        description: "Sua clínica já chegou ao máximo de 30 terapeutas cadastrados.",
        variant: "destructive",
      });
      return;
    }

    setAvailableProfessionalsSearch("");
    setAttachProfessionalOpen(true);
    setAvailableProfessionalsLoading(true);
    try {
      const rows = await api.clinicListAvailableProfessionals();
      setAvailableProfessionals(rows);
    } catch (error: any) {
      toast({
        title: "Não foi possível carregar os terapeutas disponíveis",
        description: error?.data?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setAvailableProfessionalsLoading(false);
    }
  };

  const handleCreateProfessional = async () => {
    if (!professionalForm.name.trim() || !professionalForm.email.trim() || !professionalForm.phone.trim() || !professionalForm.professional_age.trim() || !professionalForm.professional_crfa.trim() || !professionalForm.password || !professionalForm.password_confirmation) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome, email, celular, idade, CRFA e senha são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (professionalForm.password !== professionalForm.password_confirmation) {
      toast({
        title: "As senhas não conferem",
        description: "Revise a confirmação da senha do terapeuta.",
        variant: "destructive",
      });
      return;
    }

    setSavingProfessional(true);
    try {
      const created = await api.clinicCreateProfessional({
        name: professionalForm.name.trim(),
        email: professionalForm.email.trim(),
        phone: professionalForm.phone.trim(),
        professional_age: Number(professionalForm.professional_age),
        professional_crfa: professionalForm.professional_crfa.trim(),
        professional_registration: professionalForm.professional_registration.trim() || undefined,
        password: professionalForm.password,
        password_confirmation: professionalForm.password_confirmation,
      });

      setProfessionals((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setCreateProfessionalOpen(false);
      setProfessionalForm(emptyProfessionalForm());
      toast({
        title: "Terapeuta cadastrado",
        description: "O novo terapeuta já está disponível para a clínica.",
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível cadastrar o terapeuta",
        description: error?.data?.message || "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingProfessional(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!patientForm.responsible_name.trim() || !patientForm.child_name.trim() || !patientForm.child_birthdate || !patientForm.email.trim() || !patientForm.phone.trim() || !patientForm.password || !patientForm.password_confirmation) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Responsável, paciente, nascimento, email, celular e senha são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (patientForm.password !== patientForm.password_confirmation) {
      toast({
        title: "As senhas não conferem",
        description: "Revise a confirmação da senha do paciente.",
        variant: "destructive",
      });
      return;
    }

    setSavingPatient(true);
    try {
      const created = await api.clinicCreatePatient({
        responsible_name: patientForm.responsible_name.trim(),
        child_name: patientForm.child_name.trim(),
        child_birthdate: patientForm.child_birthdate,
        email: patientForm.email.trim(),
        phone: patientForm.phone.trim(),
        password: patientForm.password,
        password_confirmation: patientForm.password_confirmation,
        professional_ids: patientForm.professional_ids,
      });

      setPatients((prev) => [...prev, created].sort((a, b) => (a.child_name ?? a.name).localeCompare(b.child_name ?? b.name, "pt-BR")));
      setCreatePatientOpen(false);
      setPatientForm(emptyPatientForm());
      toast({
        title: "Paciente cadastrado",
        description: "O paciente foi criado e já pode ser vinculado aos terapeutas selecionados.",
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível cadastrar o paciente",
        description: error?.data?.message || "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSavingPatient(false);
    }
  };

  const handleAttachProfessional = async (professionalId: number) => {
    setAttachingProfessionalId(professionalId);
    try {
      await api.clinicAttachProfessional(professionalId);
      await loadClinicData();
      setAvailableProfessionals((prev) => prev.filter((professional) => professional.id !== professionalId));
      setAttachProfessionalOpen(false);
      toast({
        title: "Terapeuta vinculado",
        description: "O profissional agora faz parte da clínica e os pacientes já vinculados a ele entraram na visão da empresa.",
      });
    } catch (error: any) {
      toast({
        title: "Não foi possível vincular o terapeuta",
        description: error?.data?.message || "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAttachingProfessionalId(null);
    }
  };

  const toggleAssignedProfessional = (professionalId: number, checked: boolean) => {
    setPatientForm((prev) => ({
      ...prev,
      professional_ids: checked
        ? Array.from(new Set([...prev.professional_ids, professionalId]))
        : prev.professional_ids.filter((id) => id !== professionalId),
    }));
  };

  const filteredAvailableProfessionals = useMemo(() => {
    const query = availableProfessionalsSearch.trim().toLowerCase();
    if (!query) return availableProfessionals;
    return availableProfessionals.filter((professional) =>
      [
        professional.name,
        professional.email,
        professional.phone ?? "",
        professional.professional_crfa ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [availableProfessionals, availableProfessionalsSearch]);

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Gestão da Clínica</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Cadastre terapeutas e pacientes da sua clínica. O limite de terapeutas é de até {professionalLimit} contas e os pacientes são ilimitados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openPatientModal} className="rounded-full">
              <UserPlus size={16} className="mr-2" />
              Cadastrar paciente
            </Button>
            <Button variant="outline" onClick={() => void openAttachProfessionalModal()} className="rounded-full" disabled={limitReached}>
              <Link2 size={16} className="mr-2" />
              Vincular terapeuta existente
            </Button>
            <Button onClick={openProfessionalModal} className="rounded-full" disabled={limitReached}>
              <BriefcaseMedical size={16} className="mr-2" />
              {limitReached ? "Limite de terapeutas atingido" : "Cadastrar terapeuta"}
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-full max-w-md rounded-[28px] border border-border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("professionals")}
              className={`flex-1 rounded-[22px] px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "professionals" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Terapeutas
            </button>
            <button
              type="button"
              onClick={() => setTab("patients")}
              className={`flex-1 rounded-[22px] px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "patients" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pacientes
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-muted-foreground">
            <span className="rounded-full bg-brand-green/10 px-3 py-1.5 text-brand-green">
              {professionalCount} / {professionalLimit} terapeutas
            </span>
            <span className="rounded-full bg-brand-orange/10 px-3 py-1.5 text-brand-orange">
              {patients.length} pacientes
            </span>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "professionals" ? "Buscar terapeuta por nome, email ou CRFA..." : "Buscar paciente por nome, responsável ou email..."}
              className="pl-9 sm:pl-11 text-sm sm:text-base"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "professionals" ? (
          filteredProfessionals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <BriefcaseMedical size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum terapeuta cadastrado na clínica.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredProfessionals.map((professional) => (
                <div key={professional.id} className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                        {professional.profile_photo_url ? (
                          <img src={normalizeMediaUrl(professional.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          initials(professional.name)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{professional.name}</h3>
                        <div className="text-sm text-muted-foreground truncate flex items-center gap-2">
                          <Mail size={14} />
                          <span>{professional.email}</span>
                        </div>
                        {professional.phone ? (
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                            <Phone size={13} />
                            <span>{professional.phone}</span>
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {professional.professional_crfa ? (
                            <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green">CRFA: {professional.professional_crfa}</span>
                          ) : null}
                          {professional.professional_age ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{professional.professional_age} anos</span>
                          ) : professional.professional_birthdate ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Nascimento: {formatYmd(professional.professional_birthdate)}</span>
                          ) : null}
                          <span className="rounded-full bg-brand-orange/10 px-2.5 py-1 text-brand-orange">
                            {professional.assigned_users_count} paciente(s) vinculado(s)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredPatients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <Users size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum paciente cadastrado na clínica.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredPatients.map((patient) => {
              const displayName = patient.child_name?.trim() ? patient.child_name.trim() : patient.name;
              return (
                <div key={patient.id} className="bg-card rounded-xl border border-border p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                        {patient.profile_photo_url ? (
                          <img src={normalizeMediaUrl(patient.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          initials(displayName)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
                        {patient.responsible_name ? (
                          <p className="text-xs text-muted-foreground truncate">Responsável: {patient.responsible_name}</p>
                        ) : null}
                        <div className="text-sm text-muted-foreground truncate flex items-center gap-2">
                          <Mail size={14} />
                          <span>{patient.email}</span>
                        </div>
                        {patient.phone ? (
                          <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                            <Phone size={13} />
                            <span>{patient.phone}</span>
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {patient.child_birthdate ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Nascimento: {formatYmd(patient.child_birthdate)}</span>
                          ) : null}
                          <span className={`rounded-full px-2.5 py-1 ${patient.source === "clinic" ? "bg-brand-blue/10 text-brand-blue" : "bg-brand-brown/10 text-brand-brown"}`}>
                            {patient.source === "clinic" ? "Cadastro da clínica" : "Paciente herdado de terapeuta vinculado"}
                          </span>
                          <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green">
                            {patient.assigned_professionals.length > 0
                              ? `Terapeutas: ${patient.assigned_professionals.map((professional) => professional.name).join(", ")}`
                              : "Sem terapeuta vinculado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createProfessionalOpen} onOpenChange={setCreateProfessionalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar terapeuta</DialogTitle>
            <DialogDescription>
              Cada clínica pode manter até {professionalLimit} terapeutas ativos. Restam {remainingProfessionalSlots} vaga(s).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-professional-name">Nome completo</Label>
              <Input id="clinic-professional-name" value={professionalForm.name} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-email">Email</Label>
                <Input id="clinic-professional-email" type="email" value={professionalForm.email} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-phone">Celular</Label>
                <Input id="clinic-professional-phone" value={professionalForm.phone} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-age">Idade</Label>
                <Input id="clinic-professional-age" type="number" min={18} value={professionalForm.professional_age} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, professional_age: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-crfa">CRFA</Label>
                <Input id="clinic-professional-crfa" value={professionalForm.professional_crfa} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, professional_crfa: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-professional-registration">Registro profissional (opcional)</Label>
              <Input id="clinic-professional-registration" value={professionalForm.professional_registration} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, professional_registration: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-password">Senha</Label>
                <Input id="clinic-professional-password" type="password" value={professionalForm.password} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-professional-password-confirmation">Confirmar senha</Label>
                <Input id="clinic-professional-password-confirmation" type="password" value={professionalForm.password_confirmation} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, password_confirmation: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProfessionalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateProfessional()} disabled={savingProfessional}>
              {savingProfessional ? "Salvando..." : "Cadastrar terapeuta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachProfessionalOpen} onOpenChange={setAttachProfessionalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular terapeuta existente</DialogTitle>
            <DialogDescription>
              Traga um perfil profissional já existente para dentro do ecossistema da clínica. Os pacientes já vinculados a esse terapeuta passam a aparecer também no painel da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={availableProfessionalsSearch}
                onChange={(e) => setAvailableProfessionalsSearch(e.target.value)}
                placeholder="Buscar terapeuta disponível por nome, email ou CRFA..."
                className="pl-10"
              />
            </div>

            {availableProfessionalsLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-xl border border-border p-4">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredAvailableProfessionals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhum terapeuta disponível para vincular no momento.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAvailableProfessionals.map((professional) => (
                  <div key={professional.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{professional.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{professional.email}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {professional.phone ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Celular: {professional.phone}</span>
                          ) : null}
                          {professional.professional_crfa ? (
                            <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green">CRFA: {professional.professional_crfa}</span>
                          ) : null}
                          <span className="rounded-full bg-brand-orange/10 px-2.5 py-1 text-brand-orange">
                            {professional.assigned_users_count} paciente(s) já vinculado(s)
                          </span>
                        </div>
                      </div>

                      <Button onClick={() => void handleAttachProfessional(professional.id)} disabled={attachingProfessionalId === professional.id}>
                        {attachingProfessionalId === professional.id ? "Vinculando..." : "Trazer para a clínica"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachProfessionalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createPatientOpen} onOpenChange={setCreatePatientOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar paciente</DialogTitle>
            <DialogDescription>
              Pacientes não têm limite de cadastro. Você também pode já vincular esse paciente aos terapeutas da clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-responsible">Nome do responsável</Label>
                <Input id="clinic-patient-responsible" value={patientForm.responsible_name} onChange={(e) => setPatientForm((prev) => ({ ...prev, responsible_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-name">Nome do paciente</Label>
                <Input id="clinic-patient-name" value={patientForm.child_name} onChange={(e) => setPatientForm((prev) => ({ ...prev, child_name: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-birthdate">Data de nascimento</Label>
                <Input id="clinic-patient-birthdate" type="date" value={patientForm.child_birthdate} onChange={(e) => setPatientForm((prev) => ({ ...prev, child_birthdate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-phone">Celular</Label>
                <Input id="clinic-patient-phone" value={patientForm.phone} onChange={(e) => setPatientForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic-patient-email">Email</Label>
              <Input id="clinic-patient-email" type="email" value={patientForm.email} onChange={(e) => setPatientForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-password">Senha</Label>
                <Input id="clinic-patient-password" type="password" value={patientForm.password} onChange={(e) => setPatientForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinic-patient-password-confirmation">Confirmar senha</Label>
                <Input id="clinic-patient-password-confirmation" type="password" value={patientForm.password_confirmation} onChange={(e) => setPatientForm((prev) => ({ ...prev, password_confirmation: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <div>
                <p className="font-medium text-foreground">Terapeutas vinculados</p>
                <p className="text-sm text-muted-foreground">Selecione os terapeutas que já devem receber esse paciente.</p>
              </div>

              {professionals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cadastre pelo menos um terapeuta para poder vincular pacientes.</p>
              ) : (
                <div className="space-y-3">
                  {professionals.map((professional) => {
                    const checked = patientForm.professional_ids.includes(professional.id);
                    return (
                      <label key={professional.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleAssignedProfessional(professional.id, value === true)} />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{professional.name}</p>
                          <p className="text-sm text-muted-foreground truncate">{professional.email}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePatientOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreatePatient()} disabled={savingPatient}>
              {savingPatient ? "Salvando..." : "Cadastrar paciente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
