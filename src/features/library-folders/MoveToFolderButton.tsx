import { useState } from "react";
import { FolderInput, FolderPlus } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { folderKey, folderMemberships, folderOrder, type FolderItem } from "./library-folders";
import { folderError, moveFolderItems, saveFolder, useLibraryFolders } from "./use-library-folders";

export function MoveToFolderButton({ item, title }: { item: FolderItem; title: string }) {
  const { user } = useAuth();
  const folders = useLibraryFolders();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user || !["admin", "professional"].includes(user.role)) return null;
  const current = folderMemberships(folders.data).get(folderKey(item));
  async function move() {
    setBusy(true); setError("");
    try {
      const folderId = creating ? (await saveFolder(name.trim())).id : target ? Number(target) : null;
      await moveFolderItems(folderId, [item]);
      await folders.refresh(); setOpen(false);
    } catch (e) { setError(folderError(e)); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="icon" title="Mover para pasta" aria-label={`Mover ${title} para pasta`} onClick={e => { e.stopPropagation(); setTarget(current ? String(current) : ""); setCreating(false); setName(""); setError(""); setOpen(true); }}><FolderInput size={17} /></Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-md" onClick={e => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Mover para pasta</DialogTitle><DialogDescription className="break-words">Organize “{title}” na sua biblioteca.</DialogDescription></DialogHeader>
        {folders.isPending ? <p>Carregando pastas…</p> : folders.isError ? <div role="alert">Não foi possível carregar as pastas. <Button variant="outline" onClick={() => folders.refetch()}>Tentar novamente</Button></div> : <>
          <label className="space-y-2 text-sm"><span>Pasta de destino</span><select className="h-11 w-full rounded-lg border bg-background px-3" value={creating ? "new" : target} disabled={busy} onChange={e => { setCreating(e.target.value === "new"); setTarget(e.target.value === "new" ? "" : e.target.value); }}><option value="">Sem pasta</option>{[...(folders.data?.folders ?? [])].sort(folderOrder).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}<option value="new">+ Criar nova pasta</option></select></label>
          {creating && <label className="space-y-2 text-sm"><span>Nome da nova pasta</span><Input value={name} maxLength={80} onChange={e => setName(e.target.value)} disabled={busy} autoFocus placeholder="Ex.: Linguagem e vocabulário" /></label>}
          <p className="text-xs text-muted-foreground">Seus envios e compartilhamentos continuam funcionando.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button disabled={busy || (creating && !name.trim())} onClick={move}>{creating ? <FolderPlus size={16} className="mr-2" /> : <FolderInput size={16} className="mr-2" />}{busy ? "Salvando…" : "Mover atividade"}</Button>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
