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
import { Sparkles, Trophy } from "lucide-react";
import type React from "react";
import { getFullscreenPortalContainer } from "@/lib/fullscreen-portal";
import { playWin } from "@/lib/sfx";
import { useEffect } from "react";

export default function BrandedCongratsDialog({
  open,
  onOpenChange,
  title = "Parabéns!",
  description,
  primaryLabel = "Fechar",
  secondaryLabel,
  onPrimary,
  onSecondary,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    if (open) playWin();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        portalContainer={getFullscreenPortalContainer()}
        className="sm:max-w-xl rounded-3xl p-0 overflow-hidden bg-background/95 backdrop-blur border-border"
      >
        <div className="px-6 sm:px-8 pt-7 pb-5 bg-gradient-to-b from-brand-yellow/15 via-background to-background">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-orange/20 rounded-2xl blur-xl scale-110" />
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
              <div className="text-xs text-muted-foreground">Conquista</div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-7 pt-1">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl font-display inline-flex items-center gap-2">
              <Trophy className="h-6 w-6 text-brand-yellow" />
              {title}
              <Sparkles className="h-5 w-5 text-brand-purple" />
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-2 text-base leading-relaxed">{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          {children ? <div className="mt-5">{children}</div> : null}

          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            {secondaryLabel ? (
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={() => {
                  onSecondary?.();
                  onOpenChange(false);
                }}
              >
                {secondaryLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              className={cn("rounded-xl bg-brand-green text-white hover:bg-brand-green/90")}
              onClick={() => {
                onPrimary?.();
                onOpenChange(false);
              }}
            >
              {primaryLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


