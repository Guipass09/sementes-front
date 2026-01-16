import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as any)?.standalone;
  return window.matchMedia("(display-mode: standalone)").matches || standalone === true;
}

export default function PwaInstallButton(): JSX.Element | null {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstallPrompt(null));
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", () => setInstallPrompt(null));
    };
  }, []);

  const isIos = useMemo(() => isIosDevice(), []);
  const isStandalone = useMemo(() => isStandaloneMode(), []);
  const canPromptInstall = !!installPrompt && !isStandalone;
  const showButton = (canPromptInstall || (isIos && !isStandalone)) && typeof window !== "undefined";

  if (!showButton) return null;

  const handleConfirm = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      try {
        await installPrompt.userChoice;
      } catch {}
      setInstallPrompt(null);
      setOpen(false);
      return;
    }
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-xl"
        title="Instalar app"
      >
        <Download size={16} className="mr-2" />
        <span className="hidden lg:inline">Instalar app</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Baixar aplicativo</DialogTitle>
            <DialogDescription>
              Deseja instalar o app da Sementes da Fala no seu dispositivo?
            </DialogDescription>
          </DialogHeader>

          {installPrompt ? (
            <div className="text-sm text-muted-foreground">
              Ao confirmar, o atalho será instalado como aplicativo.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No iPhone/iPad, toque em <strong>Compartilhar</strong> e escolha
              <strong> Adicionar à Tela de Início</strong>.
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleConfirm()}>
              {installPrompt ? "Instalar" : "Entendi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
