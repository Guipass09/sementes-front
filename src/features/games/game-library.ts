export const GAME_LIBRARIES = {
  memoria: {
    title: "Jogos da Memória",
    kind: "memory_game",
    shareType: "memory_game",
    playBase: "/jogos",
  },
  memoria2: {
    title: "Memória 2.0",
    kind: "memory_game_v2",
    shareType: "memory_game",
    playBase: "/jogos/memoria2",
  },
  fonema: {
    title: "Discriminação de fonemas",
    kind: "phoneme_game",
    shareType: "phoneme_game",
    playBase: "/jogos/fonema",
  },
  auditivo: {
    title: "Estimulação auditiva",
    kind: "auditory_game",
    shareType: "auditory_game",
    playBase: "/jogos/auditivo",
  },
  forca: {
    title: "Forca",
    kind: "hangman_game",
    shareType: "hangman_game",
    playBase: "/jogos/forca",
  },
  roleta: {
    title: "Roleta musical",
    kind: "spin_wheel_game",
    shareType: "spin_wheel_game",
    playBase: "/jogos/roleta",
  },
  "caca-palavras": {
    title: "Caça-palavras",
    kind: "word_search_game",
    shareType: "word_search_game",
    playBase: "/jogos/caca-palavras",
  },
  cartas: {
    title: "Jogo das cartas",
    kind: "card_game",
    shareType: "card_game",
    playBase: "/jogos/cartas",
  },
  "acerte-imagem": {
    title: "Acerte a imagem",
    kind: "guess_image_game",
    shareType: "guess_image_game",
    playBase: "/jogos/acerte-imagem",
  },
} as const;

export type GameLibrarySlug = keyof typeof GAME_LIBRARIES;
export type LibraryGame = {
  id: number;
  title: string;
  description?: string | null;
  created_by: { id?: number; name: string };
  assigned_to?: Array<{ id: number; name: string }>;
  thumbnail?: {
    url?: string | null;
    image_url?: string | null;
    left_url?: string | null;
    main_url?: string | null;
    right_url?: string | null;
  } | null;
  cards?: Array<{ url?: string | null }>;
  items?: Array<{
    url?: string | null;
    image_url?: string | null;
    left_url?: string | null;
    right_url?: string | null;
    main_url?: string | null;
  }>;
  support_images?: Array<{ url?: string | null }>;
  background_url?: string | null;
  pairs_count?: number;
  items_count?: number;
  sessions_count?: number;
  words_count?: number;
  cards_count?: number;
};

export function gamePlayPath(slug: GameLibrarySlug, id: number) {
  return `${GAME_LIBRARIES[slug].playBase}/${id}`;
}

export function gameLibraryCount(game: LibraryGame): string {
  if (game.pairs_count != null) return `${game.pairs_count} pares`;
  if (game.cards_count != null) return `${game.cards_count} cartas`;
  if (game.words_count != null) return `${game.words_count} palavras`;
  if (game.sessions_count != null) return `${game.sessions_count} rodadas`;
  if (game.items_count != null) return `${game.items_count} imagens`;
  return `${game.support_images?.length ?? game.items?.length ?? 0} imagens`;
}

export function gameLibraryPermissions(
  slug: GameLibrarySlug,
  game: LibraryGame,
  user: { id: number; role: string },
) {
  const owner = game.created_by.id === user.id;
  const manage =
    user.role === "admin" || (user.role === "professional" && owner);
  const assignedEdit =
    user.role === "professional" &&
    ["memoria", "memoria2", "fonema", "acerte-imagem"].includes(slug) &&
    !!game.assigned_to?.length;
  return {
    edit: manage || assignedEdit,
    delete: manage || assignedEdit,
    assign: manage,
    share: manage,
  };
}

export function filterLibraryGames(
  games: LibraryGame[],
  search: string,
  patient = "all",
): LibraryGame[] {
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const term = normalize(search.trim());
  const seen = new Set<number>();
  return games.filter((game) => {
    if (seen.has(game.id)) return false;
    seen.add(game.id);
    if (
      term &&
      !normalize(`${game.title} ${game.description ?? ""}`).includes(term)
    )
      return false;
    if (patient === "unassigned") return !game.assigned_to?.length;
    return (
      patient === "all" ||
      !!game.assigned_to?.some((item) => String(item.id) === patient)
    );
  });
}
