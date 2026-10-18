import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CircleDot, Ear, Grid3X3, Image as ImageIcon, Layers, Type, type LucideIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { onUserProgressChanged } from "@/lib/user-events";

export type PatientGameItem = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  detail: string;
  path: string;
  createdAt?: string | null;
  categoryId?: string;
};

export type PatientGameCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
  items: PatientGameItem[];
};

const EMPTY_CATEGORIES: PatientGameCategory[] = [];
const EMPTY_ACTIVITIES: api.ActivityRow[] = [];

async function loadPatientLibrary() {
  let hasErrors = false;
  const load = async <T,>(request: Promise<T[]>): Promise<T[]> => {
    try {
      return await request;
    } catch (error) {
      if (api.isApiError(error) && error.status === 401) throw error;
      hasErrors = true;
      return [];
    }
  };
  const [classic, memoryV2, phoneme, auditory, hangman, spinWheel, wordSearch, cards, guessImage, activities, rounds] = await Promise.all([
    load(api.userListMemoryGames({ variant: "classic" })),
    load(api.userListMemoryGames({ variant: "v2" })),
    load(api.userListPhonemeGames()),
    load(api.userListAuditoryGames()),
    load(api.userListHangmanGames()),
    load(api.userListSpinWheelGames()),
    load(api.userListWordSearchGames()),
    load(api.userListCardGames()),
    load(api.userListGuessImageGames()),
    load(api.userListActivities()),
    load(api.listRoundGames()),
  ]);
  const item = (game: { id: number; title: string; description?: string | null; created_at?: string | null }, path: string, detail: string, imageUrl?: string | null): PatientGameItem => ({
    id: game.id, title: game.title, description: game.description, createdAt: game.created_at, path, detail, imageUrl,
  });
  const categories: PatientGameCategory[] = [
    {
      id: "sons-imagens", title: "Sons e imagens", icon: Ear, iconClassName: "text-emerald-600", iconBackgroundClassName: "bg-emerald-50",
      items: rounds.filter(g => g.kind === "sound").map(g => item(g, `/jogos/sons-imagens/${g.id}`, `${g.rounds.length} rodada(s)`, g.thumbnail?.url)),
    },
    {
      id: "sequencia-imagens", title: "Sequência de imagens", icon: ImageIcon, iconClassName: "text-sky-600", iconBackgroundClassName: "bg-sky-50",
      items: rounds.filter(g => g.kind === "sequence").map(g => item(g, `/jogos/sequencia-imagens/${g.id}`, `${g.rounds.length} rodada(s)`, g.thumbnail?.url)),
    },
    {
      id: "historias", title: "Histórias completas", icon: BookOpen, iconClassName: "text-emerald-700", iconBackgroundClassName: "bg-emerald-50",
      items: activities.filter(a => a.is_story && (a.story_steps?.length ?? 0) > 0).map(g => item(g, `/atividades/${g.id}`, `${g.story_steps?.length ?? 0} etapas`, g.thumbnail?.media_type === "video" ? g.thumbnail.thumbnail_url : g.thumbnail?.url)),
    },
    {
      id: "memoria", title: "Jogos da memória", icon: Grid3X3, iconClassName: "text-brand-green", iconBackgroundClassName: "bg-brand-green/10",
      items: classic.map(g => item(g, `/jogos/${g.id}`, `${g.pairs_count} pares`, g.thumbnail?.url)),
    },
    {
      id: "memoria2", title: "Memória 2.0", icon: Grid3X3, iconClassName: "text-brand-green", iconBackgroundClassName: "bg-brand-green/10",
      items: memoryV2.map(g => item(g, `/jogos/memoria2/${g.id}`, `${g.pairs_count} pares`, g.thumbnail?.url)),
    },
    {
      id: "fonema", title: "Discriminação de fonemas", icon: Ear, iconClassName: "text-brand-purple", iconBackgroundClassName: "bg-brand-purple/10",
      items: phoneme.map(g => item(g, `/jogos/fonema/${g.id}`, `${g.sessions_count} sessões`, g.thumbnail?.left_url)),
    },
    {
      id: "auditivo", title: "Estimulação auditiva", icon: Ear, iconClassName: "text-brand-blue", iconBackgroundClassName: "bg-brand-blue/10",
      items: auditory.map(g => item(g, `/jogos/auditivo/${g.id}`, `${g.items_count} imagens`, g.background_url)),
    },
    {
      id: "forca", title: "Jogo da forca", icon: Type, iconClassName: "text-brand-orange", iconBackgroundClassName: "bg-brand-orange/10",
      items: hangman.map(g => item(g, `/jogos/forca/${g.id}`, `${g.word_length} letras`, g.thumbnail?.url)),
    },
    {
      id: "caca-palavras", title: "Caça-palavras", icon: Grid3X3, iconClassName: "text-brand-green", iconBackgroundClassName: "bg-brand-green/10",
      items: wordSearch.map(g => item(g, `/jogos/caca-palavras/${g.id}`, `${g.words_count} palavra(s)`, g.items?.[0]?.image_url)),
    },
    {
      id: "roleta", title: "Roleta musical", icon: CircleDot, iconClassName: "text-amber-500", iconBackgroundClassName: "bg-amber-500/10",
      items: spinWheel.map(g => ({ ...item(g, `/jogos/roleta/${g.id}`, `${g.items_count} itens`, g.thumbnail?.url), description: g.center_title || "Gire a roleta!" })),
    },
    {
      id: "cartas", title: "Jogo das cartas", icon: Layers, iconClassName: "text-brand-brown", iconBackgroundClassName: "bg-brand-brown/10",
      items: cards.map(g => item(g, `/jogos/cartas/${g.id}`, `${g.cards_count} carta(s)`, g.background_url)),
    },
    {
      id: "acerte-imagem", title: "Acerte a imagem", icon: ImageIcon, iconClassName: "text-pink-500", iconBackgroundClassName: "bg-pink-500/10",
      items: guessImage.map(g => item(g, `/jogos/acerte-imagem/${g.id}`, `${g.sessions_count} sessão(ões)`, g.thumbnail?.main_url)),
    },
  ];
  return { categories, activities: activities.filter(a => !a.is_story), hasErrors };
}

export function usePatientLibrary() {
  const { user } = useAuth();
  const enabled = !!user && user.role === "user";
  const query = useQuery({
    queryKey: ["patient-library", user?.id],
    queryFn: loadPatientLibrary,
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!enabled) return;
    return onUserProgressChanged(() => void refetch());
  }, [enabled, user?.id, refetch]);

  return {
    activities: enabled ? query.data?.activities ?? EMPTY_ACTIVITIES : EMPTY_ACTIVITIES,
    categories: enabled ? query.data?.categories ?? EMPTY_CATEGORIES : EMPTY_CATEGORIES,
    loading: enabled && query.isPending,
    refreshing: query.isFetching,
    hasErrors: enabled && (query.isError || !!query.data?.hasErrors),
    refresh: refetch,
  };
}
