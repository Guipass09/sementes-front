import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Stethoscope, Users, X } from "lucide-react";
import RegisterForm, { type RegisterMode } from "@/components/RegisterForm";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./login.css";

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

const Cadastro = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<RegisterMode | null>(null);
  const [choiceOpen, setChoiceOpen] = useState(true);

  const selectMode = (mode: RegisterMode) => {
    setSelectedMode(mode);
    setChoiceOpen(false);
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
              <RegisterForm mode={selectedMode} onChangeProfile={() => setChoiceOpen(true)} />
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
