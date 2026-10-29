import type { CatalogKind } from "@/features/session/SessionCatalogTile";
import { activityCatalogImage, gameCatalogImage } from "@/features/session/SessionCatalogTile";

export type LibraryFolder = { id: number; name: string };
export type FolderItem = { type: CatalogKind; id: number };
export type FolderIndex = { folders: LibraryFolder[]; memberships: { folder_id: number; resource_type: CatalogKind; resource_id: number }[] };
export type FolderResource = FolderItem & { title: string; description?: string; imageUrl?: string | null; path: string; slug?: string; story?: any; ownerId?: number; playable: boolean };
export const folderKey = (item: FolderItem) => `${item.type}:${item.id}`;
export const folderOrder = (a: LibraryFolder, b: LibraryFolder) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true });
export const folderMemberships = (index?: FolderIndex) => new Map(index?.memberships.map(m => [`${m.resource_type}:${m.resource_id}`, m.folder_id]) ?? []);
export const ROUND_FOLDER_TYPES = { sound: ["sound_image_game", "sons-imagens"], sequence: ["image_sequence_game", "sequencia-imagens"], sentence: ["complete_sentence_game", "complete-frase"] } as const;

const groups = [
  ["activities", "activity", "", "/atividades"],
  ["memGames", "memory_game", "memoria", "/jogos"],
  ["memGames2", "memory_game_v2", "memoria2", "/jogos/memoria2"],
  ["phonemeGames", "phoneme_game", "fonema", "/jogos/fonema"],
  ["audGames", "auditory_game", "auditivo", "/jogos/auditivo"],
  ["hangGames", "hangman_game", "forca", "/jogos/forca"],
  ["spinGames", "spin_wheel_game", "roleta", "/jogos/roleta"],
  ["wordSearchGames", "word_search_game", "caca-palavras", "/jogos/caca-palavras"],
  ["cardGames", "card_game", "cartas", "/jogos/cartas"],
  ["guessImageGames", "guess_image_game", "acerte-imagem", "/jogos/acerte-imagem"],
] as const;

export function catalogResources(catalog: Record<string, any[]>): FolderResource[] {
  const rows: FolderResource[] = groups.flatMap(([key, type, slug, path]) => (catalog[key] ?? []).map(row => ({
    type, id: row.id, title: row.title, description: row.description, ownerId: row.created_by?.id,
    path: `${path}/${row.id}`, slug: row.is_story ? "historias" : slug,
    imageUrl: type === "activity" ? activityCatalogImage(row) : gameCatalogImage(row),
    story: row.is_story ? row : undefined, playable: !row.is_story || !!row.story_steps?.length,
  })));
  for (const row of catalog.roundGames ?? []) {
    const info = ROUND_FOLDER_TYPES[row.kind as keyof typeof ROUND_FOLDER_TYPES];
    if (info) rows.push({ type: info[0], id: row.id, title: row.title, description: row.description, ownerId: row.created_by?.id, path: `/jogos/${info[1]}/${row.id}`, slug: info[1], imageUrl: gameCatalogImage(row), playable: true });
  }
  return rows;
}

export function looseCatalog<T extends Record<string, any[]>>(catalog: T, index?: FolderIndex): T {
  const filed = folderMemberships(index);
  const result = { ...catalog };
  for (const [key, type] of groups) (result as Record<string, any[]>)[key] = (catalog[key] ?? []).filter(row => !filed.has(`${type}:${row.id}`));
  (result as Record<string, any[]>).roundGames = (catalog.roundGames ?? []).filter(row => {
    const info = ROUND_FOLDER_TYPES[row.kind as keyof typeof ROUND_FOLDER_TYPES];
    return !info || !filed.has(`${info[0]}:${row.id}`);
  });
  return result;
}
