import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { request } from "@/lib/laravel-api";
import type { FolderIndex, FolderItem, LibraryFolder } from "./library-folders";

export function useLibraryFolders(enabled = true) {
  const { user } = useAuth();
  const client = useQueryClient();
  const queryKey = ["library-folders", user?.id];
  const query = useQuery({ queryKey, queryFn: () => request<FolderIndex>("/api/library/folders"), enabled: enabled && !!user && ["admin", "professional"].includes(user.role), staleTime: 30000 });
  const refresh = () => client.invalidateQueries({ queryKey });
  return { ...query, refresh };
}
export const saveFolder = (name: string, id?: number) => request<LibraryFolder>(`/api/library/folders${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", json: { name } });
export const deleteFolder = (id: number) => request(`/api/library/folders/${id}`, { method: "DELETE" });
export const moveFolderItems = (folderId: number | null, items: FolderItem[]) => request("/api/library/folder-items", { method: "PUT", json: { folder_id: folderId, items } });
export const folderError = (error: any) => Object.values(error?.data?.errors ?? {}).flat().join(" ") || error?.data?.message || "Não foi possível salvar. Tente novamente.";
