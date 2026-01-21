import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import * as api from "@/lib/laravel-api";
import type { ActivityRow, AdminProfessionalRow, ProfessionalDirectoryRow } from "@/lib/laravel-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityRow | null;
  mode: "admin" | "professional";
};

export function ShareActivityModal({ open, onOpenChange, activity, mode }: Props): JSX.Element {
  const { toast } = useToast();
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professionals, setProfessionals] = useState<Array<AdminProfessionalRow | ProfessionalDirectoryRow>>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !activity) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pros, shares] = await Promise.all([
          mode === "admin" ? api.adminListProfessionals() : api.professionalListProfessionals(),
          mode === "admin" ? api.adminGetActivityShares(activity.id) : api.professionalGetActivityShares(activity.id),
        ]);
        if (cancelled) return;
        const myId = auth.user?.id ?? 0;
        const list = (pros ?? []).filter((p: any) => (p?.id ?? 0) !== myId);
        setProfessionals(list as any);
        setSelectedIds((shares.professional_ids ?? []).filter((id) => id !== myId));
      } catch {
        if (!cancelled) {
          toast({ title: "Compartilhar", description: "Não foi possível carregar a lista de profissionais.", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activity?.id, mode, toast, auth.user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professionals;
    return professionals.filter((p: any) => String(p.name || "").toLowerCase().includes(q) || String(p.email || "").toLowerCase().includes(q));
  }, [professionals, search]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onSave = async () => {
    if (!activity) return;
    setSaving(true);
    try {
      if (mode === "admin") await api.adminShareActivity(activity.id, selectedIds);
      else await api.professionalShareActivity(activity.id, selectedIds);
      toast({ title: "Compartilhar", description: "Atividade compartilhada com sucesso." });
      onOpenChange(false);
    } catch {
      toast({ title: "Compartilhar", description: "Não foi possível compartilhar agora.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar atividade</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          {activity ? (
            <>
              Compartilhar <span className="font-semibold text-foreground">“{activity.title}”</span> com outros profissionais.
              <div className="mt-1">Isso não altera os pacientes já atribuídos (não duplica envios).</div>
            </>
          ) : null}
        </div>

        <div className="mt-4">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar profissional..." />
        </div>

        <div className="mt-3 max-h-[340px] overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum profissional encontrado.</div>
          ) : (
            filtered.map((p: any) => {
              const checked = selectedIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/40 text-left"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(p.id)} />
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-purple to-brand-blue flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {p.profile_photo_url ? (
                      <img src={normalizeMediaUrl(p.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      String(p.name || "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void onSave()} disabled={saving || loading}>
            {saving ? "Salvando..." : "Compartilhar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

