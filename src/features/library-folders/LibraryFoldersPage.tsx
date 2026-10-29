import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GameLibraryCard, GAME_LIBRARY_GRID } from "@/features/games/GameLibraryCard";
import { GAME_LIBRARIES, type GameLibrarySlug } from "@/features/games/game-library";
import { gameLibraryApi } from "@/features/games/game-library-api";
import { GAME_DESTINATIONS } from "@/lib/resource-navigation";
import { FolderShelf } from "./FolderShelf";
import { catalogResources, folderKey, folderMemberships } from "./library-folders";
import { deleteFolder, folderError, saveFolder, useLibraryFolders } from "./use-library-folders";

async function loadResources(professional: boolean) {
  const slugs = Object.keys(GAME_LIBRARIES) as GameLibrarySlug[];
  const [activities, rounds, ...games] = await Promise.all([
    professional ? api.professionalListActivities() : api.adminListActivities(), api.listRoundGames(),
    ...slugs.map(slug => gameLibraryApi(slug, professional).list()),
  ]);
  const keys = ["memGames", "memGames2", "phonemeGames", "audGames", "hangGames", "spinGames", "wordSearchGames", "cardGames", "guessImageGames"];
  return catalogResources({ activities, roundGames: rounds, ...Object.fromEntries(keys.map((key, i) => [key, games[i]])) });
}

export default function LibraryFoldersPage() {
  const { user } = useAuth();
  const { folderId } = useParams();
  const navigate = useNavigate();
  const base = user?.role === "admin" ? "/admin" : "/profissional";
  const folders = useLibraryFolders();
  const resources = useQuery({ queryKey: ["folder-resources", user?.id], queryFn: () => loadResources(user?.role === "professional"), staleTime: 10000 });
  const folder = folders.data?.folders.find(f => f.id === Number(folderId));
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("meu");
  const [dialog, setDialog] = useState<"new" | "rename" | "delete" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const memberships = folderMemberships(folders.data);
  const all = (resources.data ?? []).filter(item => user?.role === "admin" || (tab === "meu" ? item.ownerId === user?.id : item.ownerId !== user?.id));
  const visible = all.filter(item => (folderId ? memberships.get(folderKey(item)) === Number(folderId) : !memberships.has(folderKey(item))) && item.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  function edit(action: "new" | "rename" | "delete") { setName(action === "rename" ? folder?.name ?? "" : ""); setError(""); setDialog(action); }
  async function submit() {
    setBusy(true); setError("");
    try {
      if (dialog === "delete" && folder) { await deleteFolder(folder.id); await folders.refresh(); navigate(`${base}/pastas`); }
      else { const saved = await saveFolder(name.trim(), dialog === "rename" ? folder?.id : undefined); await folders.refresh(); navigate(`${base}/pastas/${saved.id}`); }
      setDialog(null);
    } catch (e) { setError(folderError(e)); } finally { setBusy(false); }
  }
  const context = folder ? `?pasta=${folder.id}` : "";
  return <main className="container mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-6 sm:py-10">
    <Button asChild variant="ghost"><Link to={folderId ? `${base}/pastas` : `${base}/jogos`}><ArrowLeft size={17} className="mr-2" />{folderId ? "Todas as pastas" : "Jogos"}</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="break-words font-display text-2xl font-bold">{folder?.name ?? (folderId ? "Pasta" : "Minha biblioteca")}</h1><p className="mt-1 text-sm text-muted-foreground">{folder ? "Atividades e jogos reunidos para seus atendimentos." : "Crie pastas e organize todos os seus materiais."}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => edit("new")}><FolderPlus size={16} className="mr-2" />Nova pasta</Button>{folder && <><Button variant="outline" size="icon" aria-label="Renomear pasta" onClick={() => edit("rename")}><Pencil size={16} /></Button><Button variant="outline" size="icon" aria-label="Excluir pasta" onClick={() => edit("delete")}><Trash2 size={16} /></Button></>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button disabled={!!folderId && !folder}><Plus size={16} className="mr-2" />Criar atividade</Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-[65vh] overflow-y-auto" align="end"><DropdownMenuItem asChild><Link to={`${base}/atividades${context}${context ? "&" : "?"}criar=1`}>Slides e vídeos</Link></DropdownMenuItem>{GAME_DESTINATIONS.map(game => <DropdownMenuItem key={game.slug} asChild><Link to={`${base}/jogos/${game.slug}/novo${context}`}>{game.label}</Link></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div></header>
    {folderId && folders.isSuccess && !folder && <p role="alert">Esta pasta não está disponível. Volte para todas as pastas.</p>}
    {user?.role === "professional" && <div className="flex gap-2"><Button variant={tab === "meu" ? "default" : "outline"} onClick={() => setTab("meu")}>Meu catálogo</Button><Button variant={tab === "compartilhados" ? "default" : "outline"} onClick={() => setTab("compartilhados")}>Compartilhados</Button></div>}
    {!folderId && <FolderShelf resources={all} />}
    <label className="flex items-center gap-2 rounded-lg border px-3"><Search size={18} className="shrink-0" /><Input aria-label="Buscar atividades na pasta" className="border-0 shadow-none" placeholder="Buscar por nome…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {(folders.isError || resources.isError) ? <div role="alert" className="rounded-xl border p-5"><p>Não foi possível carregar sua biblioteca completa.</p><Button variant="outline" onClick={() => { void folders.refetch(); void resources.refetch(); }}>Tentar novamente</Button></div> : (folders.isPending || resources.isPending) ? <p>Carregando biblioteca…</p> : (!folderId || folder) && <>
    {!folderId && <h2 className="font-semibold">Sem pasta</h2>}
    <div className={GAME_LIBRARY_GRID}>{visible.map(item => <GameLibraryCard key={folderKey(item)} title={item.title} description={item.description} kind={item.type} imageUrl={item.imageUrl} playPath={item.path} playable={item.playable} editPath={(user?.role === "admin" || item.ownerId === user?.id) && item.slug ? `${base}/jogos/${item.slug}/${item.id}/editar` : undefined} />)}</div>
    {!visible.length && <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{search ? "Nenhuma atividade encontrada." : "Ainda não há atividades aqui. Crie uma atividade ou use “Mover para pasta” na sua biblioteca."}</div>}
    </>}
    <Dialog open={dialog !== null} onOpenChange={value => { if (!value && !busy) setDialog(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{dialog === "delete" ? "Excluir pasta?" : dialog === "rename" ? "Renomear pasta" : "Nova pasta"}</DialogTitle><DialogDescription>{dialog === "delete" ? "Os jogos e as atividades serão mantidos na biblioteca, sem pasta. Nenhum material será apagado." : "Escolha um nome para organizar seus jogos e atividades."}</DialogDescription></DialogHeader>{dialog !== "delete" && <Input aria-label="Nome da pasta" value={name} maxLength={80} autoFocus onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim() && !busy) void submit(); }} placeholder="Ex.: Sons do R" />}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button variant={dialog === "delete" ? "destructive" : "default"} disabled={busy || (dialog !== "delete" && !name.trim())} onClick={submit}>{busy ? "Salvando…" : dialog === "delete" ? "Excluir somente a pasta" : "Salvar pasta"}</Button></DialogContent></Dialog>
  </main>;
}
