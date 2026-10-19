import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, BadgeCheck, Building2, Loader2, Stethoscope, Users, X } from "lucide-react";
import RegisterForm, { type RegisterMode } from "@/components/RegisterForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./login.css";
import { isApiError, previewPatientRegistration } from "@/lib/laravel-api";
import type { RegistrationProfessional } from "@/features/patient-registration/registration";

const profileOptions: Array<{
  mode: RegisterMode;
  label: string;
  detail: string;
  icon: typeof Users;
  iconClassName: string;
}> = [
  { mode: "patient", label: "Paciente", detail: "Para pacientes e responsáveis", icon: Users, iconClassName: "bg-[#e5f5eb] text-[#08733d]" },
  { mode: "professional", label: "Profissional", detail: "Para fonoaudiólogos(as)", icon: Stethoscope, iconClassName: "bg-[#e7f1f6] text-[#246887]" },
  { mode: "clinic", label: "Empresa", detail: "Para clínicas e equipes", icon: Building2, iconClassName: "bg-[#fff1e2] text-[#a76524]" },
];

const profileFromSearch = (search: string): RegisterMode | null => {
  const params = new URLSearchParams(search);
  if (params.has("convite_profissional")) return "patient";
  const profile = params.get("perfil")?.toLowerCase();
  if (profile === "profissional") return "professional";
  if (profile === "paciente") return "patient";
  if (profile === "empresa" || profile === "clinica") return "clinic";
  return null;
};

const profileQuery: Record<RegisterMode, string> = {
  patient: "paciente",
  professional: "profissional",
  clinic: "empresa",
};

const Cadastro = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteToken = new URLSearchParams(location.search).get("convite_profissional");
  const [invitation, setInvitation] = useState<{ token: string; professional: RegistrationProfessional } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [selectedMode, setSelectedMode] = useState<RegisterMode | null>(() => profileFromSearch(location.search));
  const [choiceOpen, setChoiceOpen] = useState(() => !profileFromSearch(location.search));

  useEffect(() => {
    if (inviteToken === null) return;
    const previous = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const tag = previous ?? document.createElement("meta");
    const original = tag.content;
    tag.name = "referrer";
    tag.content = "no-referrer";
    if (!previous) document.head.appendChild(tag);
    return () => { if (previous) tag.content = original; else tag.remove(); };
  }, [inviteToken]);

  useEffect(() => {
    setInvitation(null);
    setInviteError("");
    if (inviteToken === null) return;
    let cancelled = false;
    void previewPatientRegistration(inviteToken).then(({ professional }) => {
      if (!cancelled) setInvitation({ token: inviteToken, professional });
    }).catch((error) => {
      if (!cancelled) setInviteError(isApiError(error)
        ? error.data?.errors?.token?.[0] || error.data?.errors?.registration_invite?.[0] || error.data?.message || "Este convite não está disponível. Peça um novo link ao profissional."
        : "Não foi possível conferir o convite. Tente novamente.");
    });
    return () => { cancelled = true; };
  }, [inviteToken, previewAttempt]);

  useEffect(() => {
    const profile = profileFromSearch(location.search);
    setSelectedMode(profile);
    setChoiceOpen(!profile);
  }, [location.search]);

  const selectMode = (mode: RegisterMode) => {
    setSelectedMode(mode);
    setChoiceOpen(false);
    navigate(`/cadastro?perfil=${profileQuery[mode]}`, { replace: true });
  };

  const closeChoice = () => {
    if (selectedMode) setChoiceOpen(false);
    else navigate("/");
  };

  return (
  <main className="auth-login auth-login--register">
    <header className="auth-login__nav">
      <Link to="/" className="auth-login__brand" aria-label="Sementes da Fala, página inicial">
        <img src="/landing/sementes-logo-transparent.png" alt="" width="68" height="68" />
        <span><strong>Sementes</strong> da Fala</span>
      </Link>
      <Link to="/" className="auth-login__back">
        <ArrowLeft size={17} />
        <span>Voltar ao site</span>
      </Link>
    </header>

    <div className="auth-login__grid">
      <section className="auth-login__photo" aria-labelledby="auth-register-title">
        <img
          src="/landing/cadastro-teleatendimento.png"
          alt="Criança e responsável participando de um atendimento fonoaudiológico online"
          fetchPriority="high"
        />
        <div className="auth-login__photo-shade" />
        <div className="auth-login__photo-copy">
          <p className="auth-login__eyebrow">UM ESPAÇO PARA CUIDAR E EVOLUIR</p>
          <h1 id="auth-register-title">Sementes da Fala</h1>
          <p>O atendimento começa aqui.</p>
        </div>
      </section>

      <section className="auth-login__panel" aria-labelledby={selectedMode ? "auth-register-form-title" : undefined}>
        <div className={choiceOpen ? "auth-login__form hidden" : "auth-login__form"}>
          {selectedMode && (
            <>
              <p className="auth-login__form-label">FAÇA PARTE DA PLATAFORMA</p>
              <h2 id="auth-register-form-title">Crie sua conta.</h2>
              <p className="auth-login__form-intro">Preencha seus dados para continuar.</p>
              {inviteToken !== null && (!invitation || invitation.token !== inviteToken) ? (
                <div className="space-y-4 border-y border-border py-6" role={inviteError ? "alert" : "status"}>
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">{inviteError ? <AlertCircle size={19} className="shrink-0 text-destructive" /> : <Loader2 size={19} className="shrink-0 animate-spin text-primary" />}{inviteError || "Conferindo seu convite..."}</p>
                  {inviteError && <button type="button" className="text-sm font-semibold text-primary" onClick={() => setPreviewAttempt((value) => value + 1)}>Tentar novamente</button>}
                </div>
              ) : <>
                {invitation && <div className="mb-5 flex items-start gap-3 border-y border-border py-4"><BadgeCheck size={22} className="mt-1 shrink-0 text-primary" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Convite de acompanhamento</p><p className="break-words font-semibold text-foreground">{invitation.professional.name}</p>{invitation.professional.registration && <p className="text-xs text-muted-foreground">{invitation.professional.registration}</p>}</div></div>}
                <RegisterForm mode={selectedMode} onChangeProfile={() => setChoiceOpen(true)} registrationInvite={inviteToken !== null ? invitation ?? undefined : undefined} />
              </>}
            </>
          )}
        </div>
        <footer className="auth-login__footer">
          © {new Date().getFullYear()} Sementes da Fala
        </footer>
      </section>
    </div>

    <Dialog open={choiceOpen} onOpenChange={(open) => { if (!open) closeChoice(); }}>
      <DialogContent hideClose className="max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] max-w-[560px] gap-0 overflow-y-auto rounded-md border-[#c9dccf] bg-[#f8fbf9] p-0 shadow-2xl sm:rounded-md">
        <DialogHeader className="relative border-b border-[#dce9e0] px-5 pb-5 pt-6 text-left sm:px-7 sm:pb-6 sm:pt-7">
          <button type="button" onClick={closeChoice} className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-[#416354] hover:bg-[#e5f1e9]" aria-label={selectedMode ? "Fechar seleção" : "Voltar ao site"}>
            <X size={18} />
          </button>
          <p className="text-xs font-bold uppercase text-[#0b7540]">Sementes da Fala</p>
          <DialogTitle className="pt-2 font-display text-2xl font-bold leading-tight text-[#253e32] sm:text-[28px]">Criar conta</DialogTitle>
          <DialogDescription className="pt-1 text-sm text-[#66786d]">Escolha seu perfil.</DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-[#dce9e0]">
          {profileOptions.map(({ mode, label, detail, icon: Icon, iconClassName }) => (
            <button
              key={mode}
              type="button"
              onClick={() => selectMode(mode)}
              className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b7540] sm:px-7 sm:py-5"
            >
              <span className={`flex h-12 w-12 flex-none items-center justify-center rounded-md ${iconClassName}`}><Icon size={22} strokeWidth={1.8} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-[#253e32]">{label}</span>
                <span className="block text-sm text-[#66786d]">{detail}</span>
              </span>
              <ArrowRight size={18} className="flex-none text-[#59796a] transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
        <div className="border-t border-[#dce9e0] px-5 py-4 text-center text-sm text-[#66786d] sm:px-7">
          Já tem uma conta? <Link to="/entrar" className="font-semibold text-[#0b7540] hover:underline">Entrar</Link>
        </div>
      </DialogContent>
    </Dialog>
  </main>
  );
};

export default Cadastro;
