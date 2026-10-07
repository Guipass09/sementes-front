import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, ImagePlus, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import * as api from "@/lib/laravel-api";
import type { GameRound, RoundGameInput, RoundGameKind, RoundGameRow } from "@/lib/laravel-api";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { RoundGameBoard } from "./RoundGameView";
import { roundGameInfo, validateRounds } from "./round-game";
import "./round-games.css";

const newRound = (): GameRound => ({ id: crypto.randomUUID(), prompt: "", choices: [] });
function message(error: unknown) {
  if (api.isApiError(error)) return Object.values(error.data?.errors || {}).flat().join(" ") || error.data?.message || "Não foi possível salvar.";
  return "Não foi possível concluir. Verifique a conexão e tente novamente.";
}

export default function RoundGameEditor({ kind }: { kind: RoundGameKind }) {
  const { id } = useParams();
  return <RoundGameEditorForm key={`${kind}-${id || "new"}`} kind={kind} />;
}

function RoundGameEditorForm({ kind }: { kind: RoundGameKind }) {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const base = user?.role === "admin" ? "/admin" : "/profissional";
  const info = roundGameInfo[kind];
  const [form, setForm] = useState<RoundGameInput>(() => ({ kind, title: "", description: "", background_color: "#ffffff", background_path: null, rounds: [newRound()] }));
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const backgroundInput = useRef<HTMLInputElement>(null);
  const round = form.rounds[active];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    get();
    async function get() {
      try {
        const game = await api.getRoundGame(Number(id));
        if (cancelled) return;
        if (!game.can_edit || game.kind !== kind) { setLoadError("Você não pode editar este jogo."); return; }
        setForm(game); setBackgroundUrl(game.background_url);
      } catch (e) { if (!cancelled) setLoadError(message(e)); }
      finally { if (!cancelled) setLoading(false); }
    }
    return () => { cancelled = true; };
  }, [id, kind]);

  function updateRound(updater: (r: GameRound) => GameRound) {
    setForm(f => ({ ...f, rounds: f.rounds.map((r, i) => i === active ? updater(r) : r) }));
  }
  async function upload(files: File[], background = false) {
    if (!files.length) return;
    if (!background && round.choices.length + files.length > 100) { setError("Cada rodada aceita até 100 figuras. Divida as demais em outra rodada."); return; }
    const roundId = round.id;
    setUploading(true); setError("");
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Use imagens JPG, PNG, GIF ou WebP de até 10 MB.");
        const uploaded = await api.uploadRoundImage(file);
        if (background) { setForm(f => ({ ...f, background_path: uploaded.path })); setBackgroundUrl(uploaded.url); }
        else setForm(f => ({ ...f, rounds: f.rounds.map(r => r.id === roundId ? { ...r, choices: [...r.choices, { ...uploaded, id: crypto.randomUUID(), label: "", correct: false }] } : r) }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : message(e)); }
    finally { setUploading(false); }
  }
  function moveChoice(index: number, direction: number) {
    updateRound(r => { const choices = [...r.choices]; [choices[index], choices[index + direction]] = [choices[index + direction], choices[index]]; return { ...r, choices }; });
  }
  function moveRound(direction: number) {
    setForm(f => { const rounds = [...f.rounds]; [rounds[active], rounds[active + direction]] = [rounds[active + direction], rounds[active]]; return { ...f, rounds }; });
    setActive(active + direction);
  }
  const invalid = !form.title.trim() ? "Dê um nome ao jogo." : validateRounds(form.rounds, kind);
  async function save() {
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError("");
    try {
      await api.saveRoundGame({ kind, title: form.title.trim(), description: form.description, background_color: form.background_color, background_path: form.background_path, rounds: form.rounds }, id ? Number(id) : undefined);
      toast({ title: "Jogo salvo na biblioteca" });
      navigate(`${base}/jogos/${info.slug}`);
    } catch (e) { setError(message(e)); }
    finally { setSaving(false); }
  }
  const previewGame: RoundGameRow = { ...form, id: Number(id) || 0, background_url: backgroundUrl, created_by: { id: user?.id || 0, name: user?.name || "", role: user?.role || "professional" }, thumbnail: { url: form.rounds[0]?.choices[0]?.url || null }, assigned_to: [], can_edit: true };
  if (loading) return <div role="status" className="p-8">Carregando jogo...</div>;
  if (loadError) return <div role="alert" className="p-8"><p>{loadError}</p><Button onClick={() => navigate(`${base}/jogos/${info.slug}`)}>Voltar à biblioteca</Button></div>;

  return <div className="round-editor">
    <header className="round-editor__heading"><div className="flex items-center gap-3 min-w-0"><Button size="icon" variant="ghost" aria-label="Voltar" title="Voltar" onClick={() => navigate(`${base}/jogos/${info.slug}`)}><ArrowLeft size={20} /></Button><div><p className="text-sm text-muted-foreground">{info.title}</p><h1>{id ? "Editar jogo" : "Criar jogo"}</h1></div></div><div className="flex gap-2"><Button variant="outline" disabled={uploading || saving} onClick={() => invalid ? setError(invalid) : setPreview(true)}><Eye size={18} className="mr-2" />Prévia</Button><Button onClick={save} disabled={saving || uploading}>{saving ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Save size={18} className="mr-2" />}Salvar</Button></div></header>
    {error && <p role="alert" className="mb-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <section className="round-editor__details" aria-label="Dados do jogo">
      <div className="round-editor__field"><Label htmlFor="round-title">Nome do jogo</Label><Input id="round-title" maxLength={255} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
      <div className="round-editor__field"><Label htmlFor="round-description">Descrição (opcional)</Label><Textarea id="round-description" maxLength={10000} value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div className="round-editor__background"><Label htmlFor="round-color">Fundo</Label><input id="round-color" type="color" aria-label="Cor de fundo" title="Cor de fundo" value={form.background_color} onChange={e => setForm({ ...form, background_color: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-border p-1" /><input ref={backgroundInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" aria-label="Imagem de fundo" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload([file], true); }} /><Button variant="outline" disabled={uploading} onClick={() => backgroundInput.current?.click()}><ImagePlus size={18} className="mr-2" />Imagem de fundo</Button>{backgroundUrl && <><img src={normalizeMediaUrl(backgroundUrl)} alt="Fundo selecionado" /><Button variant="ghost" size="icon" title="Remover imagem de fundo" aria-label="Remover imagem de fundo" onClick={() => { setBackgroundUrl(null); setForm({ ...form, background_path: null }); }}><X size={18} /></Button></>}</div>
    </section>
    <div className="round-editor__tabs" role="tablist" aria-label="Rodadas">{form.rounds.map((r, i) => <Button role="tab" aria-selected={active === i} key={r.id} variant={active === i ? "default" : "outline"} disabled={uploading || saving} onClick={() => setActive(i)}>Rodada {i + 1}</Button>)}<Button variant="outline" disabled={uploading || saving || form.rounds.length >= 100} onClick={() => { setForm(f => ({ ...f, rounds: [...f.rounds, newRound()] })); setActive(form.rounds.length); }}><Plus size={18} className="mr-2" />Rodada</Button></div>
    <section aria-label={`Editar rodada ${active + 1}`}>
      <div className="round-editor__field"><Label htmlFor="round-prompt">Pergunta da rodada</Label><Input id="round-prompt" value={round.prompt} maxLength={1000} placeholder={kind === "sound" ? "Quais palavras começam com o som /s/?" : "O que aconteceu primeiro?"} onChange={e => updateRound(r => ({ ...r, prompt: e.target.value }))} /></div>
      <div className="round-editor__tools"><h2 className="font-semibold">{kind === "sequence" ? "Sequência correta" : "Figuras e respostas"} <span className="text-muted-foreground font-normal">({round.choices.length})</span></h2><div className="flex gap-2"><Button size="icon" variant="outline" aria-label="Mover rodada para trás" title="Mover rodada para trás" disabled={active === 0 || uploading} onClick={() => moveRound(-1)}><ArrowUp size={16} /></Button><Button size="icon" variant="outline" aria-label="Mover rodada para frente" title="Mover rodada para frente" disabled={active === form.rounds.length - 1 || uploading} onClick={() => moveRound(1)}><ArrowDown size={16} /></Button><Button size="icon" variant="outline" aria-label="Excluir rodada" title="Excluir rodada" disabled={form.rounds.length === 1 || uploading} onClick={() => { if (window.confirm("Excluir esta rodada e suas figuras do jogo?")) { setForm(f => ({ ...f, rounds: f.rounds.filter((_, i) => i !== active) })); setActive(Math.max(0, active - 1)); } }}><Trash2 size={16} /></Button></div></div>
      <div className="round-editor__figures">{round.choices.map((choice, index) => <article className="round-editor__figure" key={choice.id}>
        <img src={normalizeMediaUrl(choice.url || "")} alt={choice.label || `Figura ${index + 1}`} />
        <div className="round-editor__figure-fields"><Label htmlFor={`label-${choice.id}`}>Legenda (opcional)</Label><Input id={`label-${choice.id}`} value={choice.label} maxLength={255} onChange={e => updateRound(r => ({ ...r, choices: r.choices.map(c => c.id === choice.id ? { ...c, label: e.target.value } : c) }))} />
          {kind === "sound" ? <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={choice.correct} onCheckedChange={value => updateRound(r => ({ ...r, choices: r.choices.map(c => c.id === choice.id ? { ...c, correct: value === true } : c) }))} />Resposta correta</label> : <span className="text-sm font-semibold text-brand-green">Posição {index + 1}</span>}
          <div className="round-editor__figure-controls"><div className="flex gap-1"><Button size="icon" variant="ghost" title="Mover figura para trás" aria-label={`Mover figura ${index + 1} para trás`} disabled={index === 0} onClick={() => moveChoice(index, -1)}><ArrowUp size={17} /></Button><Button size="icon" variant="ghost" title="Mover figura para frente" aria-label={`Mover figura ${index + 1} para frente`} disabled={index === round.choices.length - 1} onClick={() => moveChoice(index, 1)}><ArrowDown size={17} /></Button></div><Button size="icon" variant="ghost" className="text-destructive" title="Excluir figura" aria-label={`Excluir figura ${index + 1}`} onClick={() => updateRound(r => ({ ...r, choices: r.choices.filter(c => c.id !== choice.id) }))}><Trash2 size={17} /></Button></div>
        </div>
      </article>)}</div>
      {!round.choices.length && <div className="round-editor__empty"><ImagePlus size={30} className="mx-auto mb-3" />Nenhuma figura nesta rodada</div>}
      <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" aria-label="Adicionar imagens" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; void upload(files); }} />
      <Button className="mt-5" variant="outline" disabled={uploading || saving} onClick={() => fileInput.current?.click()}>{uploading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <ImagePlus size={18} className="mr-2" />}{uploading ? "Enviando imagens..." : "Adicionar figuras"}</Button>
    </section>
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="flex max-h-[94svh] w-[96vw] max-w-6xl flex-col overflow-hidden p-4"><DialogHeader><DialogTitle>Prévia · {form.title}</DialogTitle></DialogHeader><div className="min-h-0 overflow-auto"><RoundGameBoard game={previewGame} /></div></DialogContent></Dialog>
  </div>;
}
