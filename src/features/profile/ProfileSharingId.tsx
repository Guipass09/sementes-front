import { useEffect, useState } from "react";
import { Check, Copy, Fingerprint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function ProfileSharingId({ shareId }: { shareId?: string | null }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [copied]);
  const copy = async () => {
    if (!shareId) return;
    try { await navigator.clipboard.writeText(shareId); setCopied(true); setFailed(false); }
    catch { setFailed(true); }
  };
  return <div className="mt-5 border-t border-border pt-5">
    <Label htmlFor="profile-sharing-id" className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Fingerprint size={15} />ID de compartilhamento</Label>
    <div className="flex min-w-0 gap-2">
      <Input id="profile-sharing-id" value={shareId ?? "Indisponível"} readOnly onFocus={(event) => event.target.select()}
        className="min-w-0 bg-card font-mono text-xs font-medium sm:text-sm" aria-readonly="true" />
      <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" disabled={!shareId} onClick={() => void copy()} aria-label="Copiar ID de compartilhamento" className="shrink-0">
        {copied ? <Check size={16} className="text-brand-green-dark" /> : <Copy size={16} />}
      </Button></TooltipTrigger><TooltipContent>{copied ? "ID copiado" : "Copiar ID"}</TooltipContent></Tooltip>
    </div>
    <p role="status" aria-live="polite" className="mt-2 min-h-4 text-xs text-muted-foreground">{copied ? "ID copiado" : failed ? "Selecione o ID para copiar." : "Seu identificador entre profissionais"}</p>
  </div>;
}
