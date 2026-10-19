import { useEffect, useRef, useState } from "react";
import { AlertCircle, BadgeCheck, CheckCircle2, Fingerprint, Loader2, Search, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { isApiError, lookupSharingProfessional } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { profileInitials } from "@/features/profile/profile";
import { normalizedSharingId, type SharingProfessional } from "./professional-share";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceKey: string;
  kind: "atividade" | "jogo";
  title: string;
  onShare: (shareId: string) => Promise<unknown>;
};

export default function ProfessionalShareDialog({ open, onOpenChange, resourceKey, kind, title, onShare }: Props) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [professional, setProfessional] = useState<SharingProfessional | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const sendPending = useRef(false);
  useEffect(() => {
    revision.current++;
    setValue(""); setProfessional(null); setError(""); setSearching(false);
    return () => { revision.current++; };
  }, [open, resourceKey]);

  const lookup = async () => {
    if (sending || searching) return;
    const request = ++revision.current;
    setError(""); setProfessional(null);
    const normalized = normalizedSharingId(value);
    if (!normalized) { setSearching(false); setError("Confira o ID de compartilhamento do profissional."); return; }
    setValue(normalized);
    setSearching(true);
    try {
      const result = await lookupSharingProfessional(normalized);
      if (revision.current === request) setProfessional(result);
    } catch (error) {
      if (revision.current === request) setError(isApiError(error)
        ? error.data?.errors?.professional_share_id?.[0] || error.data?.message || "Não foi possível buscar esse profissional."
        : "Não foi possível buscar esse profissional. Tente novamente.");
    } finally { if (revision.current === request) setSearching(false); }
  };
  const share = async () => {
    if (!professional || searching || sendPending.current) return;
    sendPending.current = true;
    setSending(true); setError("");
    try {
      await onShare(professional.share_id);
      toast({ title: "Compartilhamento concluído", description: `Enviado para ${professional.name}.` });
      onOpenChange(false);
    } catch (error) {
      setError(isApiError(error) ? error.data?.errors?.professional_share_id?.[0] || error.data?.message || "Não foi possível compartilhar. Tente novamente." : "Não foi possível compartilhar. Tente novamente.");
    } finally { setSending(false); sendPending.current = false; }
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!sendPending.current) onOpenChange(next); }}>
    <DialogContent className="max-h-[calc(100svh-24px)] w-[calc(100vw-24px)] max-w-md gap-0 overflow-y-auto rounded-lg border-[#cbded4] p-0">
      <DialogHeader className="border-b border-border px-6 pb-5 pt-6 text-left">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-brand-green-dark"><Share2 size={20} /></span>
        <DialogTitle className="font-display text-xl tracking-normal">Compartilhar {kind}</DialogTitle>
        <DialogDescription className="break-words pt-1 text-sm">{title}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 px-6 py-5">
        <form onSubmit={(event) => { event.preventDefault(); void lookup(); }} className="space-y-2" aria-label="Buscar destinatário por ID">
          <Label htmlFor="share-professional-id">ID do profissional</Label>
          <div className="flex min-w-0 gap-2">
            <div className="relative min-w-0 flex-1"><Fingerprint size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input id="share-professional-id" value={value} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="SF-A1B2-C3D4-E5F6" disabled={sending}
                className="min-w-0 bg-card pl-10 font-mono text-sm" onChange={(event) => {
                  revision.current++; setValue(event.target.value); setProfessional(null); setSearching(false); setError("");
                }} />
            </div>
            <Tooltip><TooltipTrigger asChild><Button type="submit" variant="outline" size="icon" className="shrink-0" disabled={sending || searching || !value.trim()} aria-label="Buscar profissional por ID">
              {searching ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />}
            </Button></TooltipTrigger><TooltipContent>Buscar por ID</TooltipContent></Tooltip>
          </div>
        </form>
        {searching && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Buscando profissional...</p>}
        {professional && <div className="flex items-center gap-3 rounded-lg border border-[#cbded4] bg-[#f5faf7] p-4" aria-label="Profissional encontrado">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5eee9] text-sm font-semibold text-[#345e50]">
            {professional.profile_photo_url ? <img src={normalizeMediaUrl(professional.profile_photo_url)} alt="" className="h-full w-full object-cover" /> : profileInitials(professional.name)}
          </span>
          <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-foreground">{professional.name}</p>
            {professional.registration && <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground"><BadgeCheck size={14} className="shrink-0 text-brand-green-dark" /><span className="break-all">{professional.registration}</span></p>}
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{professional.share_id}</p>
          </div>
          <CheckCircle2 size={18} className="shrink-0 text-brand-green-dark" />
        </div>}
        {error && <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
        <Button type="button" disabled={!professional || sending || searching} onClick={() => void share()} className="bg-[#18664d] hover:bg-[#12533e]">
          {sending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}Compartilhar
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}
