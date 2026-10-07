import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Film, Gamepad2, ImagePlus, Plus, Save, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import type { ActivityMediaRow, StoryStep } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { loadStoryGames, storyGameLabels, type StoryGameChoice } from "./story-games";

type DraftStep =
  | { key: string; type: "media"; media?: ActivityMediaRow; file?: File }
  | { key: string; type: "game"; game: StoryGameChoice };

const newKey = () => crypto.randomUUID();

export default function StoryEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const role = user?.role === "admin" ? "admin" : "professional";
  const base = role === "admin" ? "/admin" : "/profissional";
  const [savedId, setSavedId] = useState<number | null>(id ? Number(id) : null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [games, setGames] = useState<StoryGameChoice[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string; email?: string }>>([]);
  const [assignedTo, setAssignedTo] = useState<number[]>([]);
  const [gamePickerOpen, setGamePickerOpen] = useState(false);
  const [gameSearch, setGameSearch] = useState("");
  const [gameType, setGameType] = useState("all");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSavedId(id ? Number(id) : null); }, [id]);

  useEffect(() => {
    let active = true;
    void loadStoryGames(role).then((rows) => { if (active) setGames(rows); });
    void (role === "admin" ? api.adminListUsers().then((rows) => rows.filter((row) => row.role === "user"))
      : api.professionalListUsers().then((res) => res.data ?? []))
      .then((rows) => { if (active) setUsers(rows); }).catch(() => {});
    return () => { active = false; };
  }, [role]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void (role === "admin" ? api.adminGetActivity(Number(id)) : api.professionalGetActivity(Number(id)))
      .then((story) => {
        if (!active) return;
        if (!story.is_story) throw new Error("Esta atividade não é uma história.");
        setTitle(story.title);
        setDescription(story.description);
        setAssignedTo((story.assigned_to ?? []).map((item) => item.id));
        setSteps((story.story_steps ?? []).map((step): DraftStep => step.type === "media"
          ? { key: newKey(), type: "media", media: story.media.find((item) => item.id === step.media_id) }
          : { key: newKey(), type: "game", game: {
            type: step.game_type, id: step.game_id,
            title: `${storyGameLabels[step.game_type]} #${step.game_id}`,
            category: storyGameLabels[step.game_type],
          } }));
      })
      .catch((error) => toast({ title: "Não foi possível abrir a história", description: String(error?.message || error), variant: "destructive" }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, role]);

  const filteredGames = useMemo(() => games.filter((game) =>
    (gameType === "all" || game.type === gameType) &&
    `${game.title} ${game.category}`.toLocaleLowerCase("pt-BR").includes(gameSearch.toLocaleLowerCase("pt-BR"))
  ), [games, gameSearch, gameType]);

  const move = (index: number, offset: number) => setSteps((current) => {
    const target = index + offset;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async () => {
    if (!title.trim() || !description.trim() || steps.length === 0) {
      toast({ title: "Preencha o título, o objetivo e adicione pelo menos uma etapa.", variant: "destructive" });
      return;
    }
    if (steps.length > 100) {
      toast({ title: "A história pode ter até 100 etapas.", variant: "destructive" });
      return;
    }
    if (steps.some((step) => step.type === "media" && step.file && !/^(image|video)\//.test(step.file.type))) {
      toast({ title: "Use fotos, GIFs ou vídeos em formatos compatíveis.", variant: "destructive" });
      return;
    }
    const oversized = steps.find((step) => step.type === "media" && step.file && step.file.size > 95 * 1024 * 1024);
    if (oversized?.type === "media") {
      toast({ title: "Arquivo muito grande", description: `${oversized.file?.name} excede o limite de 95 MB.`, variant: "destructive" });
      return;
    }
    if (steps.some((step) => step.type === "media" && !step.media && !step.file)) {
      toast({ title: "Uma mídia da história não está disponível.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let activityId = savedId;
      if (!activityId) {
        const created = await (role === "admin" ? api.adminCreateActivity : api.professionalCreateActivity)({
          title: title.trim(), description: description.trim(), category: "História completa",
          assigned_to: [], media: [], is_story: true,
        });
        activityId = created.id;
        setSavedId(activityId);
      }

      const resolved: DraftStep[] = [];
      for (const step of steps) {
        if (step.type !== "media" || !step.file) { resolved.push(step); continue; }
        const media = await (role === "admin" ? api.adminAddActivityMedia : api.professionalAddActivityMedia)({
          activity_id: activityId, file: step.file,
          media_type: step.file.type.startsWith("video/") ? "video" : "image",
          caption: step.file.name.replace(/\.[^.]+$/, ""), position: resolved.length,
        });
        resolved.push({ key: step.key, type: "media", media });
        setSteps((current) => current.map((item) => item.key === step.key ? { key: step.key, type: "media", media } : item));
      }

      const payload: StoryStep[] = resolved.map((step) => step.type === "game"
        ? { type: "game", game_type: step.game.type, game_id: step.game.id }
        : { type: "media", media_id: step.media!.id });
      await api.saveStorySteps(activityId, payload, role);
      await (role === "admin" ? api.adminUpdateActivity : api.professionalUpdateActivity)(activityId, {
        title: title.trim(), description: description.trim(), assigned_to: assignedTo,
      });
      toast({ title: "História salva", description: "A sequência já está na sua biblioteca." });
      navigate(`${base}/jogos/historias`);
    } catch (error: any) {
      toast({ title: "Não foi possível salvar", description: String(error?.data?.message || error?.message || error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container py-10 text-sm text-muted-foreground">Carregando história...</div>;

  return (
    <div className="container max-w-6xl px-4 py-6 sm:py-9 space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" title="Voltar" onClick={() => navigate(`${base}/jogos/historias`)}><ArrowLeft className="h-4 w-4" /></Button>
          <div><h1 className="text-2xl font-display font-semibold text-foreground">{id ? "Editar história" : "Criar história completa"}</h1>
            <p className="text-sm text-muted-foreground">Monte o percurso do atendimento, etapa por etapa.</p></div>
        </div>
        <Button onClick={() => void save()} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Salvando..." : "Salvar história"}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor="story-title" className="text-sm font-medium">Nome da história</label>
          <Input id="story-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="Ex: A viagem dos sons" /></div>
        <div className="space-y-2"><label htmlFor="story-objective" className="text-sm font-medium">Objetivo clínico</label>
          <Textarea id="story-objective" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={10000} placeholder="Ex: praticar os fonemas /s/ e /z/" /></div>
      </div>

      <section className="border-t border-border pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Sequência</h2><p className="text-sm text-muted-foreground">{steps.length} etapa{steps.length === 1 ? "" : "s"}</p></div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="sr-only" aria-label="Selecionar fotos, GIFs ou vídeos" onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setSteps((current) => [...current, ...files.map((file): DraftStep => ({ key: newKey(), type: "media", file }))]);
              event.target.value = "";
            }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><ImagePlus className="h-4 w-4 mr-2" />Foto, GIF ou vídeo</Button>
            <Button variant="outline" onClick={() => setGamePickerOpen(true)}><Gamepad2 className="h-4 w-4 mr-2" />Adicionar jogo</Button>
          </div>
        </div>
        {steps.length === 0 ? <div className="border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">Adicione a primeira etapa da história.</div> : null}
        <div className="space-y-2">
          {steps.map((step, index) => {
            const availableGame = step.type === "game" ? games.find((game) => game.type === step.game.type && game.id === step.game.id) : null;
            const name = step.type === "game" ? availableGame?.title || step.game.title : step.file?.name || step.media?.caption || (step.media?.media_type === "video" ? "Vídeo" : "Imagem");
            const image = step.type === "game" ? availableGame?.imageUrl || step.game.imageUrl : step.media?.thumbnail_url || (step.media?.media_type === "image" ? step.media.url : null);
            return <div key={step.key} className="grid min-h-20 grid-cols-[1.25rem_3.5rem_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-[1.25rem_5rem_minmax(0,1fr)_auto] sm:gap-3">
              <span className="text-center text-sm font-semibold text-muted-foreground">{index + 1}</span>
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded border bg-muted sm:w-20">
                {image ? <img src={normalizeMediaUrl(image)} alt="" className="h-full w-full object-cover" /> : step.type === "game" ? <Gamepad2 className="h-5 w-5" /> : <Film className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{name}</div><div className="text-xs text-muted-foreground">{step.type === "game" ? step.game.category : step.file?.type.startsWith("video/") || step.media?.media_type === "video" ? "Vídeo" : "Imagem / GIF"}</div></div>
              <div className="col-span-2 col-start-2 flex justify-end gap-1 sm:col-span-1 sm:col-start-4">
                <Button variant="ghost" size="icon" title="Mover para cima" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Mover para baixo" disabled={index === steps.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Remover etapa" onClick={() => setSteps((current) => current.filter((item) => item.key !== step.key))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>;
          })}
        </div>
      </section>

      <section className="border-t border-border pt-5 space-y-3">
        <h2 className="text-lg font-semibold">Enviar para pacientes</h2>
        <p className="text-sm text-muted-foreground">Pode ficar só na sua biblioteca e ser enviada depois.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((patient) => <label key={patient.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm cursor-pointer">
            <Checkbox checked={assignedTo.includes(patient.id)} onCheckedChange={() => setAssignedTo((current) => current.includes(patient.id) ? current.filter((id) => id !== patient.id) : [...current, patient.id])} />
            <span className="min-w-0"><span className="block truncate font-medium">{patient.name}</span><span className="block truncate text-xs text-muted-foreground">{patient.email}</span></span>
          </label>)}
          {users.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum paciente vinculado.</p> : null}
        </div>
      </section>

      <Dialog open={gamePickerOpen} onOpenChange={setGamePickerOpen}><DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Escolher jogo</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={gameSearch} onChange={(event) => setGameSearch(event.target.value)} className="pl-9" placeholder="Buscar jogo" /></div>
          <select aria-label="Tipo de jogo" value={gameType} onChange={(event) => setGameType(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">Todos os jogos</option>{Object.entries(storyGameLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></div>
        <div className="min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
          {filteredGames.map((game) => <button key={`${game.type}-${game.id}`} type="button" onClick={() => { setSteps((current) => [...current, { key: newKey(), type: "game", game }]); setGamePickerOpen(false); }} className="flex items-center gap-3 rounded-md border border-border p-2 text-left hover:border-primary hover:bg-muted/50">
            <div className="h-14 w-16 shrink-0 overflow-hidden rounded bg-muted flex items-center justify-center">{game.imageUrl ? <img src={normalizeMediaUrl(game.imageUrl)} alt="" className="h-full w-full object-cover" /> : <Gamepad2 className="h-5 w-5" />}</div>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{game.title}</div><div className="text-xs text-muted-foreground">{game.category}</div></div><Plus className="ml-auto h-4 w-4 shrink-0" />
          </button>)}
          {filteredGames.length === 0 ? <div className="col-span-full py-8 text-center text-sm text-muted-foreground">Nenhum jogo encontrado.</div> : null}
        </div>
      </DialogContent></Dialog>
    </div>
  );
}
