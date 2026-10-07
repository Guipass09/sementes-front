import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Edit3, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import type { ActivityRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { activityCatalogImage } from "@/features/session/SessionCatalogTile";

export default function StoryLibrary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const role = user?.role === "admin" ? "admin" : "professional";
  const base = role === "admin" ? "/admin" : "/profissional";
  const [stories, setStories] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<ActivityRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await (role === "admin" ? api.adminListActivities() : api.professionalListActivities());
      setStories(rows.filter((row) => row.is_story));
    } catch (error: any) {
      toast({ title: "Não foi possível carregar as histórias", description: String(error?.message || error), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [role]);
  const filtered = useMemo(() => stories.filter((story) => story.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [stories, search]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await (role === "admin" ? api.adminDeleteActivity : api.professionalDeleteActivity)(deleting.id);
      setStories((current) => current.filter((story) => story.id !== deleting.id));
      toast({ title: "História excluída" });
    } catch (error: any) {
      toast({ title: "Não foi possível excluir", description: String(error?.message || error), variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return <div className="container px-4 py-6 sm:py-9 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-display font-semibold">Histórias completas</h1><p className="text-sm text-muted-foreground">Sequências de imagens, GIFs, vídeos e jogos.</p></div>
      <Button onClick={() => navigate(`${base}/jogos/historias/novo`)}><Plus className="h-4 w-4 mr-2" />Nova história</Button>
    </div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar histórias" className="pl-9" /></div>
    {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : filtered.length === 0 ? <div className="border-t border-border py-14 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Nenhuma história encontrada.</p></div> :
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((story) => {
          const own = story.created_by?.id === user?.id;
          const thumbnail = activityCatalogImage(story);
          return <article key={story.id} className="overflow-hidden rounded-md border border-border bg-card">
            <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">{thumbnail ? <img src={normalizeMediaUrl(thumbnail)} alt="" className="h-full w-full object-cover" /> : <BookOpen className="h-10 w-10 text-muted-foreground" />}</div>
            <div className="p-4 space-y-3">
              <div><h2 className="line-clamp-2 font-semibold">{story.title}</h2><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{story.description}</p></div>
              <div className="text-xs text-muted-foreground">{story.story_steps?.length ? `${story.story_steps.length} etapas` : "Rascunho"} · {story.assigned_to?.length ?? 0} pacientes{!own ? " · Compartilhada" : ""}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!story.story_steps?.length} onClick={() => navigate(`/atividades/${story.id}`)}><Eye className="mr-1.5 h-4 w-4" />Abrir</Button>
                {own || role === "admin" ? <Button size="sm" variant="outline" onClick={() => navigate(`${base}/jogos/historias/${story.id}/editar`)}><Edit3 className="mr-1.5 h-4 w-4" />Editar e enviar</Button> : null}
                {own || role === "admin" ? <Button size="icon" variant="ghost" title="Excluir história" onClick={() => setDeleting(story)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : null}
              </div>
            </div>
          </article>;
        })}
      </div>}
    <BrandedConfirmDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="Excluir história?" description="A história será removida da biblioteca e dos pacientes para quem foi enviada. Os jogos originais não serão excluídos." confirmLabel="Excluir" variant="danger" onConfirm={() => void remove()} />
  </div>;
}
