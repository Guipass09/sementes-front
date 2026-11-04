import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Gamepad2, Sparkles, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  name: string;
  isTrial: boolean;
};

const trialBenefits = [
  { icon: Video, label: "Atender ao vivo com interação na tela" },
  { icon: Gamepad2, label: "Criar jogos e atividades para sua prática" },
  { icon: Activity, label: "Enviar atividades para as famílias como tarefa de casa" },
];

export default function ProfessionalTrialWelcomeDialog({ name, isTrial }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const firstName = name.trim().split(/\s+/)[0] || "profissional";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("trial") !== "started") return;

    if (isTrial) setOpen(true);
    params.delete("trial");
    const remainingSearch = params.toString();
    navigate({
      pathname: location.pathname,
      search: remainingSearch ? `?${remainingSearch}` : "",
      hash: location.hash,
    }, { replace: true });
  }, [isTrial, location.hash, location.pathname, location.search, navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-3xl border-0 bg-white p-0 shadow-2xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#087a42] via-[#0e9c59] to-[#22b875] px-6 py-7 text-white sm:px-8 sm:py-8">
          <div aria-hidden="true" className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[26px] border-white/10" />
          <div aria-hidden="true" className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
              <Sparkles size={14} aria-hidden="true" /> Boas-vindas à plataforma
            </span>
            <DialogHeader className="mt-5 space-y-2 text-left">
              <DialogTitle className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                {firstName}, você ganhou 3 dias gratuitos!
              </DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-relaxed text-white/90 sm:text-base">
                Seu período de acesso completo já começou. Aproveite para conhecer tudo o que pode fazer por sua prática.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <ul className="space-y-3">
            {trialBenefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 rounded-xl border border-[#d9ebe1] bg-[#f6fbf8] p-3.5 text-sm font-medium leading-relaxed text-foreground sm:p-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e0f4e8] text-[#087a42]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="pt-1">{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-[#f3dfad] bg-[#fff9e9] p-4 text-sm leading-relaxed text-[#604a1b]">
            Ao final dos 3 dias, será necessário escolher um plano para continuar usando os recursos. Tudo o que você criar ficará salvo; o acesso será bloqueado até a ativação da assinatura.
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              Começar a explorar
            </button>
            <Link to="/profissional/assinatura" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Ver planos <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
