import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus, Search } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import type { ActivityRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { activityCatalogImage } from "@/features/session/SessionCatalogTile";
import { GameLibraryCard, GAME_LIBRARY_GRID } from "@/features/games/GameLibraryCard";

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
      <div className={GAME_LIBRARY_GRID}>
        {filtered.map((story) => {
          const own = story.created_by?.id === user?.id;
          const thumbnail = activityCatalogImage(story);
          const manage = own || role === "admin";
          return <GameLibraryCard key={story.id} title={story.title} description={story.description} subtitle={story.story_steps?.length ? `${story.story_steps.length} etapas` : "Rascunho"} imageUrl={thumbnail} kind="activity" playPath={`/atividades/${story.id}`} playable={!!story.story_steps?.length} editPath={manage ? `${base}/jogos/historias/${story.id}/editar` : undefined} onSend={manage ? () => navigate(`${base}/jogos/historias/${story.id}/editar`) : undefined} onDelete={manage ? () => setDeleting(story) : undefined} footer={`${story.assigned_to?.length ?? 0} pacientes${!own ? " · Compartilhada" : ""}`} />;
        })}
      </div>}
    <BrandedConfirmDialog open={!!deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="Excluir história?" description="A história será removida da biblioteca e dos pacientes para quem foi enviada. Os jogos originais não serão excluídos." confirmLabel="Excluir" variant="danger" onConfirm={() => void remove()} />
  </div>;
}
