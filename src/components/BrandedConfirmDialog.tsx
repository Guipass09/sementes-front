import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getFullscreenPortalContainer } from "@/lib/fullscreen-portal";

export default function BrandedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  onConfirm,
  onCancel,
  variant = "default",
  confirmDisabled = false,
  hideClose = false,
  disableClose = false,
  confirmClassName,
  cancelClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Compat: uso antigo em alguns lugares do app */
  confirmText?: string;
  cancelLabel?: string | null;
  /** Compat: uso antigo em alguns lugares do app */
  cancelText?: string | null;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "success" | "danger";
  confirmDisabled?: boolean;
  /** Esconde o X do modal (fechar) */
  hideClose?: boolean;
  /** Impede fechar por ESC/clicar fora (útil para passos obrigatórios) */
  disableClose?: boolean;
  confirmClassName?: string;
  cancelClassName?: string;
}) {
  const resolvedConfirmLabel = confirmLabel ?? confirmText ?? "Confirmar";
  const resolvedCancelLabel = cancelLabel ?? cancelText ?? "Cancelar";
  const headerBg =
    variant === "success"
      ? "from-brand-green/15 via-background to-background"
      : variant === "danger"
        ? "from-red-600/10 via-background to-background"
        : "from-brand-blue/10 via-background to-background";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        portalContainer={getFullscreenPortalContainer()}
        hideClose={hideClose}
        onEscapeKeyDown={disableClose ? (e) => e.preventDefault() : undefined}
        onInteractOutside={disableClose ? (e) => e.preventDefault() : undefined}
        className="sm:max-w-xl rounded-3xl p-0 overflow-hidden bg-background/95 backdrop-blur border-border"
      >
        <div className={cn("px-6 sm:px-8 pt-7 pb-5 bg-gradient-to-b", headerBg)}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-green/20 rounded-2xl blur-xl scale-110" />
              <img
                src={logoImage}
                alt="Sementes da Fala"
                className="relative w-14 h-14 rounded-2xl object-contain bg-white/70 shadow-sm app-logo-pop"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-lg leading-tight">
                <span className="text-brand-green">Sementes</span>{" "}
                <span className="text-brand-brown">da Fala</span>
              </div>
              <div className="text-xs text-muted-foreground">Confirmação</div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-7 pt-1">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-display">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="mt-2 text-base leading-relaxed">{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            {resolvedCancelLabel == null ? null : (
              <Button
                type="button"
                variant="secondary"
                className={cn("rounded-xl", cancelClassName)}
                onClick={() => {
                  onCancel?.();
                  onOpenChange(false);
                }}
              >
                {resolvedCancelLabel}
              </Button>
            )}
            <Button
              type="button"
              className={cn(
                "rounded-xl",
                variant === "success" && "bg-brand-green text-white hover:bg-brand-green/90",
                variant === "danger" && "bg-red-600 text-white hover:bg-red-600/90",
                confirmClassName,
              )}
              disabled={confirmDisabled}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {resolvedConfirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


