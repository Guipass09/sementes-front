import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useLibraryFolders } from "./use-library-folders";

export function CreationFolderNotice() {
  const { user } = useAuth();
  const { search } = useLocation();
  const id = Number(new URLSearchParams(search).get("pasta"));
  const folders = useLibraryFolders(id > 0);
  const client = useQueryClient();
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["library-folders", user?.id] }); void client.invalidateQueries({ queryKey: ["folder-resources", user?.id] }); };
    window.addEventListener("library-folder-created-item", refresh);
    return () => window.removeEventListener("library-folder-created-item", refresh);
  }, [client, user?.id]);
  const folder = folders.data?.folders.find(f => f.id === id);
  if (!folder) return null;
  const base = user?.role === "admin" ? "/admin" : "/profissional";
  return <div className="mx-3 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:mx-6"><FolderOpen size={20} className="shrink-0 text-primary" /><span className="min-w-0 break-words">Novas atividades serão salvas em <strong>{folder.name}</strong>.</span><Link className="ml-auto shrink-0 font-medium text-primary underline" to={`${base}/pastas/${id}`}>Abrir pasta</Link></div>;
}
