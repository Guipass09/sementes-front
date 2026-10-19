import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, CircleCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { registrationWelcome, registrationWelcomeKey, type RegistrationProfessional } from "./registration";

export function RegistrationWelcomeContent({ professional, onContinue }: { professional: RegistrationProfessional; onContinue: () => void }) {
  return <>
    <DialogHeader className="px-6 pb-6 pt-8 text-center sm:px-8 sm:text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e4f5ec] text-[#0b7540]"><CircleCheck size={35} strokeWidth={1.6} /></span>
      <p className="mb-2 text-xs font-semibold uppercase text-[#0b7540]">Cadastro concluído</p>
      <DialogTitle className="font-display text-2xl leading-tight tracking-normal text-[#183c35]">Tudo pronto para começar.</DialogTitle>
      <DialogDescription className="pt-2 text-sm leading-relaxed">Sua conta foi criada com sucesso e você já está vinculado ao profissional:</DialogDescription>
    </DialogHeader>
    <div className="border-y border-[#d7e7de] bg-[#f3f9f6] px-6 py-6 sm:px-8">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c9ded3] bg-white text-[#0b7540]">
          {professional.photo_url ? <img src={normalizeMediaUrl(professional.photo_url)} alt="" className="h-full w-full object-cover" /> : <UserRound size={27} strokeWidth={1.6} />}
        </span>
        <div className="min-w-0"><p className="break-words text-base font-semibold text-[#183c35]">{professional.name}</p>
          {professional.registration && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#486658]"><BadgeCheck size={15} className="shrink-0 text-[#0b7540]" /><span className="break-all">{professional.registration}</span></p>}
        </div>
      </div>
    </div>
    <div className="space-y-5 px-6 pb-6 pt-5 sm:px-8">
      <p className="text-center text-sm leading-relaxed text-muted-foreground">Seu espaço de cuidado já está conectado. Seja bem-vindo à Sementes da Fala.</p>
      <Button onClick={onContinue} className="w-full">Acessar meu espaço<ArrowRight size={17} className="ml-2" /></Button>
    </div>
  </>;
}

export default function RegistrationWelcomeDialog({ patientId }: { patientId: number }) {
  const [welcome, setWelcome] = useState<{ patientId: number; professional: RegistrationProfessional } | null>(null);
  useEffect(() => {
    try {
      const professional = registrationWelcome(sessionStorage.getItem(registrationWelcomeKey), patientId);
      setWelcome(professional ? { patientId, professional } : null);
    } catch { setWelcome(null); }
  }, [patientId]);
  const close = () => {
    setWelcome(null);
    try { sessionStorage.removeItem(registrationWelcomeKey); } catch { /* No persistent modal state. */ }
  };
  const active = welcome?.patientId === patientId ? welcome.professional : null;
  return <Dialog open={!!active} onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent hideClose className="max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] max-w-[460px] gap-0 overflow-y-auto rounded-lg border-[#c9ded3] border-t-4 border-t-[#128368] p-0 shadow-xl">
      {active && <RegistrationWelcomeContent professional={active} onContinue={close} />}
    </DialogContent>
  </Dialog>;
}
