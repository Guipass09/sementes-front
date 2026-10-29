import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionCatalogTile } from "@/features/session/SessionCatalogTile";
import { folderMemberships, folderOrder, folderKey, type FolderResource } from "./library-folders";
import { useLibraryFolders } from "./use-library-folders";
import { useAuth } from "@/auth/AuthContext";

export function FolderShelf({ resources, onSelect, showEmpty = true }: { resources?: FolderResource[]; onSelect?: (item: FolderResource) => void; showEmpty?: boolean }) {
  const { user } = useAuth();
  const query = useLibraryFolders();
  const [open, setOpen] = useState<number | null>(null);
  const base = user?.role === "admin" ? "/admin" : "/profissional";
  const memberships = folderMemberships(query.data);
  const folders = [...(query.data?.folders ?? [])].sort(folderOrder).map(folder => ({ ...folder, items: resources?.filter(item => memberships.get(folderKey(item)) === folder.id) ?? [] }));
  if (!user || !["admin", "professional"].includes(user.role) || user.clinic_name) return null;
  return <section className="mb-6 space-y-3" aria-label="Pastas da biblioteca">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Minhas pastas</h2><p className="text-xs text-muted-foreground">Jogos e atividades organizados do seu jeito.</p></div>{!onSelect && <Button asChild variant="outline"><Link to={`${base}/pastas`}><FolderPlus size={16} className="mr-2" />Organizar pastas</Link></Button>}</div>
    {query.isError ? <p role="alert" className="text-sm text-muted-foreground">Não foi possível carregar as pastas. <button className="underline" onClick={() => query.refetch()}>Tentar novamente</button></p> : query.isPending ? <p className="text-sm text-muted-foreground">Carregando pastas…</p> : <>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">{folders.filter(f => showEmpty || f.items.length).map(folder => {
        const content = <><span className="rounded-xl bg-primary/10 p-3 text-primary">{open === folder.id ? <FolderOpen size={24} /> : <Folder size={24} />}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{folder.name}</span>{resources && <span className="text-xs text-muted-foreground">{folder.items.length} atividade(s)</span>}</span>{onSelect && <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open === folder.id ? "rotate-180" : ""}`} />}</>;
        const cls = "flex min-h-20 min-w-0 items-center gap-3 rounded-xl border bg-card p-3 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary";
        return onSelect ? <button key={folder.id} className={cls} aria-expanded={open === folder.id} onClick={() => setOpen(open === folder.id ? null : folder.id)}>{content}</button> : <Link key={folder.id} className={cls} to={`${base}/pastas/${folder.id}`}>{content}</Link>;
      })}</div>
      {!folders.length && !onSelect && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Crie sua primeira pasta e use o botão “Mover para pasta” nos jogos e nas atividades.</p>}
      {onSelect && open !== null && <div className="rounded-xl border bg-muted/20 p-3"><h3 className="mb-3 font-semibold">{folders.find(f => f.id === open)?.name}</h3><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">{folders.find(f => f.id === open)?.items.map(item => <button key={folderKey(item)} className="overflow-hidden rounded-lg border bg-card text-left hover:border-primary disabled:opacity-60" disabled={!item.playable} onClick={() => onSelect(item)}><SessionCatalogTile title={item.title} kind={item.type} imageUrl={item.imageUrl} /></button>)}</div>{!folders.find(f => f.id === open)?.items.length && <p className="text-sm text-muted-foreground">Nenhuma atividade nesta pasta nesta aba.</p>}</div>}
    </>}
  </section>;
}
