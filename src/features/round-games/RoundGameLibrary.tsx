import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Pencil, Play, Plus, Search, Send, Share2, Trash2 } from "lucide-react";
import * as api from "@/lib/laravel-api";
import type { RoundGameKind, RoundGameRow } from "@/lib/laravel-api";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShareGameModal } from "@/features/games/ShareGameModal";
import { SessionCatalogTile } from "@/features/session/SessionCatalogTile";
import { useToast } from "@/hooks/use-toast";
import { roundGameInfo } from "./round-game";

export default function RoundGameLibrary({ kind }: { kind: RoundGameKind }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const base = user?.role === "admin" ? "/admin" : "/profissional";
  const info = roundGameInfo[kind];
  const [games, setGames] = useState<RoundGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<RoundGameRow | null>(null);
  const [sharing, setSharing] = useState<RoundGameRow | null>(null);
  const [deleting, setDeleting] = useState<RoundGameRow | null>(null);
  const [patients, setPatients] = useState<Array<{ id: number; name: string }>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setGames(await api.listRoundGames(kind)); } catch { setError("Não foi possível carregar a biblioteca."); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { void reload(); }, [reload]);
  async function sendTo(game: RoundGameRow) {
    setSending(game); setSelected([]); setPatientSearch(""); setPatients([]); setPatientsLoading(true);
    try { const rows = user?.role === "admin" ? (await api.adminListUsers()).filter(u => u.role === "user") : (await api.professionalListUsers()).data; setPatients(rows); }
    catch { toast({ title: "Não foi possível carregar pacientes", variant: "destructive" }); }
    finally { setPatientsLoading(false); }
  }
  async function assign() {
    if (!sending) return;
    setBusy(true);
    try { const game = await api.assignRoundGame(sending.id, selected); setGames(g => g.map(item => item.id === game.id ? game : item)); setSending(null); toast({ title: "Jogo enviado aos pacientes" }); }
    catch { toast({ title: "Não foi possível enviar o jogo", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try { await api.deleteRoundGame(deleting.id); setGames(g => g.filter(item => item.id !== deleting.id)); setDeleting(null); toast({ title: "Jogo excluído" }); }
    catch { toast({ title: "Não foi possível excluir o jogo", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <div className="container mx-auto px-4 py-8">
    <header className="flex flex-wrap justify-between gap-4 mb-6"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" aria-label="Voltar aos jogos" title="Voltar aos jogos" onClick={() => navigate(`${base}/jogos`)}><ArrowLeft size={20} /></Button><h1 className="text-2xl font-display font-semibold">{info.title}</h1></div><Button onClick={() => navigate(`${base}/jogos/${info.slug}/novo`)}><Plus size={18} className="mr-2" />Novo jogo</Button></header>
    <div className="relative mb-6"><Search size={18} className="absolute left-3 top-3 text-muted-foreground" /><Input className="pl-10" aria-label="Buscar jogos" placeholder="Buscar jogos..." value={search} onChange={e => setSearch(e.target.value)} /></div>
    {loading ? <p role="status">Carregando biblioteca...</p> : error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={reload}>Tentar novamente</Button></div> : <>
      {([true, false] as const).map(own => {
        const rows = games.filter(g => (g.created_by.id === user?.id) === own && g.title.toLowerCase().includes(search.toLowerCase()));
        if (!rows.length) return null;
        return <section key={String(own)} className="mb-8"><h2 className="font-semibold mb-4">{own ? "Minha biblioteca" : "Compartilhados"}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{rows.map(game => <article key={game.id} className="overflow-hidden rounded-lg border border-border bg-card">
          <button type="button" className="block w-full text-left" onClick={() => navigate(`/jogos/${info.slug}/${game.id}`)} aria-label={`Jogar ${game.title}`}><SessionCatalogTile title={game.title} subtitle={`${game.rounds.length} rodada(s)`} imageUrl={game.thumbnail.url} kind={info.type} /></button>
          <div className="px-3 pb-3 flex flex-wrap gap-2"><Button variant="outline" size="icon" aria-label={`Jogar ${game.title}`} title="Jogar" onClick={() => navigate(`/jogos/${info.slug}/${game.id}`)}><Play size={17} /></Button>{game.can_edit && <Button variant="outline" size="icon" aria-label={`Editar ${game.title}`} title="Editar" onClick={() => navigate(`${base}/jogos/${info.slug}/${game.id}/editar`)}><Pencil size={17} /></Button>}<Button size="sm" onClick={() => void sendTo(game)}><Send size={16} className="mr-2" />Enviar</Button>{game.can_edit && <><Button variant="outline" size="icon" title="Compartilhar com profissionais" aria-label={`Compartilhar ${game.title}`} onClick={() => setSharing(game)}><Share2 size={17} /></Button><Button variant="outline" size="icon" className="text-destructive" title="Excluir" aria-label={`Excluir ${game.title}`} onClick={() => setDeleting(game)}><Trash2 size={17} /></Button></>}</div>
          {!!game.assigned_to.length && <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">Enviado a {game.assigned_to.length} paciente(s)</p>}
        </article>)}</div></section>;
      })}
      {!games.filter(g => g.title.toLowerCase().includes(search.toLowerCase())).length && <p className="text-muted-foreground py-8">Nenhum jogo encontrado.</p>}
    </>}
    <Dialog open={!!sending} onOpenChange={open => { if (!open && !busy) setSending(null); }}><DialogContent className="flex max-h-[85svh] flex-col"><DialogHeader><DialogTitle>Enviar aos pacientes</DialogTitle><DialogDescription>{sending?.title}</DialogDescription></DialogHeader><Input aria-label="Buscar paciente" placeholder="Buscar paciente..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} /><div className="min-h-0 overflow-auto space-y-3 py-2">{patientsLoading ? <p>Carregando pacientes...</p> : patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase())).map(p => <label key={p.id} className="flex items-center gap-3 text-sm cursor-pointer"><Checkbox checked={selected.includes(p.id)} onCheckedChange={on => setSelected(ids => on ? [...ids, p.id] : ids.filter(id => id !== p.id))} />{p.name}{sending?.assigned_to.some(a => a.id === p.id) && <Check size={16} className="text-brand-green ml-auto" />}</label>)}{!patientsLoading && !patients.length && <p className="text-sm text-muted-foreground">Nenhum paciente disponível.</p>}</div><Button disabled={busy || !selected.length} onClick={assign}><Send size={18} className="mr-2" />{busy ? "Enviando..." : "Enviar jogo"}</Button></DialogContent></Dialog>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir jogo?</DialogTitle><DialogDescription>“{deleting?.title}” será removido da biblioteca e dos pacientes que o receberam. Histórias que usam este jogo precisarão ser ajustadas.</DialogDescription></DialogHeader><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>Cancelar</Button><Button variant="destructive" onClick={remove} disabled={busy}>Excluir jogo</Button></div></DialogContent></Dialog>
    {sharing && <ShareGameModal open onOpenChange={open => { if (!open) setSharing(null); }} mode={user?.role === "admin" ? "admin" : "professional"} gameId={sharing.id} gameType={info.type} title={sharing.title} />}
  </div>;
}
