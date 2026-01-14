import { Button } from "@/components/ui/button";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { cn } from "@/lib/utils";
import type { JoinSessionMeta } from "@/lib/laravel-api";

export function JoinSessionButton(props: {
  meta?: JoinSessionMeta | null;
  className?: string;
  onClick?: () => void;
}) {
  const meta = props.meta;
  if (!meta?.visible) return null;

  const label = (meta.label || "Entrar na sessão").trim();
  const enabled = !!meta.enabled;
  const blink = !!meta.blink;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={!enabled}
      onClick={props.onClick}
      className={cn(
        "h-auto px-3 py-2 rounded-xl",
        "flex flex-col items-center justify-center gap-1",
        "min-w-[112px]",
        blink ? "animate-pulse" : "",
        !enabled ? "opacity-60" : "",
        props.className
      )}
      title={!enabled && meta.reason ? meta.reason : undefined}
    >
      <img
        src={(meta.logo_url || logoImage) as string}
        alt="Logo"
        className="h-6 w-6 object-contain"
        loading="lazy"
      />
      <span className="text-[11px] leading-tight font-semibold text-center">{label}</span>
    </Button>
  );
}

