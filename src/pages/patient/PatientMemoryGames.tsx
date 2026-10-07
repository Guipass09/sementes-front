import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CircleDot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Ear,
  Gamepad2,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import type {
  ActivityRow,
  AuditoryGameRow,
  CardGameRow,
  GuessImageGameRow,
  HangmanGameRow,
  MemoryGameRow,
  PhonemeGameRow,
  SpinWheelGameRow,
  WordSearchGameRow,
} from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { gameNoticeKey, markGameOpened, reconcileGameNotices, type GameNoticeState } from "./game-notices";
import "./patient-games.css";

type GameItem = {
  id: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  detail: string;
  path: string;
};

type GameCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
  items: GameItem[];
};

const gameCount = (count: number) => `${count} ${count === 1 ? "jogo disponível" : "jogos disponíveis"}`;
const noticeStorageKey = (userId: number) => `sementes:patient-game-notices:v1:${userId}`;

const readGameNotices = (userId: number): GameNoticeState | null => {
  try {
    const stored = localStorage.getItem(noticeStorageKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed?.known) && Array.isArray(parsed?.pending)) {
      return {
        known: parsed.known.filter((key: unknown): key is string => typeof key === "string"),
        pending: parsed.pending.filter((key: unknown): key is string => typeof key === "string"),
      };
    }
  } catch {
    // Storage can be disabled or contain data from an older version.
  }
  return null;
};

const saveGameNotices = (userId: number, state: GameNoticeState) => {
  try {
    localStorage.setItem(noticeStorageKey(userId), JSON.stringify(state));
  } catch {
    // Keep the current page usable even when storage is unavailable.
  }
};

export default function PatientMemoryGames() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canTrackNew, setCanTrackNew] = useState(false);
  const [pendingGameKeys, setPendingGameKeys] = useState<Set<string>>(() => new Set());
  const [games, setGames] = useState<MemoryGameRow[]>([]);
  const [gamesV2, setGamesV2] = useState<MemoryGameRow[]>([]);
  const [phonemeGames, setPhonemeGames] = useState<PhonemeGameRow[]>([]);
  const [auditoryGames, setAuditoryGames] = useState<AuditoryGameRow[]>([]);
  const [hangmanGames, setHangmanGames] = useState<HangmanGameRow[]>([]);
  const [spinWheelGames, setSpinWheelGames] = useState<SpinWheelGameRow[]>([]);
  const [wordSearchGames, setWordSearchGames] = useState<WordSearchGameRow[]>([]);
  const [cardGames, setCardGames] = useState<CardGameRow[]>([]);
  const [guessImageGames, setGuessImageGames] = useState<GuessImageGameRow[]>([]);
  const [stories, setStories] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCanTrackNew(false);
      setPendingGameKeys(new Set());
      let hadLoadError = false;
      try {
        const [memClassic, memV2, phon, aud, hang, spin, ws, cards, guessImg, assignedActivities] = await Promise.all([
          api.userListMemoryGames({ variant: "classic" }).catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar memory games:", err);
            return [];
          }),
          api.userListMemoryGames({ variant: "v2" }).catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar memory games v2:", err);
            return [];
          }),
          api.userListPhonemeGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar phoneme games:", err);
            return [];
          }),
          api.userListAuditoryGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar auditory games:", err);
            return [];
          }),
          api.userListHangmanGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar hangman games:", err);
            return [];
          }),
          api.userListSpinWheelGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar spin wheel games:", err);
            return [];
          }),
          api.userListWordSearchGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar word search games:", err);
            return [];
          }),
          api.userListCardGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar card games:", err);
            return [];
          }),
          api.userListGuessImageGames().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar guess image games:", err);
            return [];
          }),
          api.userListActivities().catch(err => {
            hadLoadError = true;
            console.error("[Jogos] Erro ao buscar histórias:", err);
            return [];
          }),
        ]);
        if (!cancelled) {
          setGames(memClassic);
          setGamesV2(memV2);
          setPhonemeGames(phon);
          setAuditoryGames(aud);
          setHangmanGames(hang);
          setSpinWheelGames(spin);
          setWordSearchGames(ws);
          setCardGames(cards);
          setGuessImageGames(guessImg);
          setStories(assignedActivities.filter(activity => activity.is_story && (activity.story_steps?.length ?? 0) > 0));
          setCanTrackNew(!hadLoadError);
        }
      } catch (error) {
        console.error("[Jogos] Erro geral ao buscar jogos:", error);
        if (!cancelled) {
          setGames([]);
          setGamesV2([]);
          setPhonemeGames([]);
          setAuditoryGames([]);
          setHangmanGames([]);
          setSpinWheelGames([]);
          setWordSearchGames([]);
          setCardGames([]);
          setGuessImageGames([]);
          setStories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const categories = useMemo<GameCategory[]>(() => [
    {
      id: "historias",
      title: "Histórias Completas",
      icon: BookOpen,
      iconClassName: "text-emerald-700",
      iconBackgroundClassName: "bg-emerald-50",
      items: stories.map(story => ({
        id: story.id,
        title: story.title,
        description: story.description,
        imageUrl: story.media.find(item => item.media_type !== "video")?.url,
        detail: `${story.story_steps?.length ?? 0} etapas`,
        path: `/atividades/${story.id}`,
      })),
    },
    {
      id: "memoria",
      title: "Jogos da Memória",
      icon: Grid3X3,
      iconClassName: "text-brand-green",
      iconBackgroundClassName: "bg-brand-green/10",
      items: games.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.thumbnail?.url,
        detail: `${g.pairs_count} pares`,
        path: `/jogos/${g.id}`,
      })),
    },
    {
      id: "memoria2",
      title: "Memória 2.0",
      icon: Grid3X3,
      iconClassName: "text-brand-green",
      iconBackgroundClassName: "bg-brand-green/10",
      items: gamesV2.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.thumbnail?.url,
        detail: `${g.pairs_count} pares`,
        path: `/jogos/memoria2/${g.id}`,
      })),
    },
    {
      id: "fonema",
      title: "Discriminação Fonema",
      icon: Ear,
      iconClassName: "text-brand-purple",
      iconBackgroundClassName: "bg-brand-purple/10",
      items: phonemeGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.thumbnail?.left_url,
        detail: `${g.sessions_count} sessões`,
        path: `/jogos/fonema/${g.id}`,
      })),
    },
    {
      id: "auditivo",
      title: "Estimulação Auditiva",
      icon: Ear,
      iconClassName: "text-brand-blue",
      iconBackgroundClassName: "bg-brand-blue/10",
      items: auditoryGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.background_url,
        detail: `${g.items_count} imagens`,
        path: `/jogos/auditivo/${g.id}`,
      })),
    },
    {
      id: "forca",
      title: "Jogo da Forca",
      icon: Type,
      iconClassName: "text-brand-orange",
      iconBackgroundClassName: "bg-brand-orange/10",
      items: hangmanGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.thumbnail?.url,
        detail: `${g.word_length} letras`,
        path: `/jogos/forca/${g.id}`,
      })),
    },
    {
      id: "caca-palavras",
      title: "Caça-palavras",
      icon: Grid3X3,
      iconClassName: "text-brand-green",
      iconBackgroundClassName: "bg-brand-green/10",
      items: wordSearchGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.items?.[0]?.image_url,
        detail: `${g.words_count} palavra(s)`,
        path: `/jogos/caca-palavras/${g.id}`,
      })),
    },
    {
      id: "roleta",
      title: "Roleta Musical",
      icon: CircleDot,
      iconClassName: "text-amber-500",
      iconBackgroundClassName: "bg-amber-500/10",
      items: spinWheelGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.center_title || "Gire a roleta!",
        imageUrl: g.thumbnail?.url,
        detail: `${g.items_count} itens`,
        path: `/jogos/roleta/${g.id}`,
      })),
    },
    {
      id: "cartas",
      title: "Jogo das Cartas",
      icon: Layers,
      iconClassName: "text-brand-brown",
      iconBackgroundClassName: "bg-brand-brown/10",
      items: cardGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.background_url,
        detail: `${g.cards_count} carta(s)`,
        path: `/jogos/cartas/${g.id}`,
      })),
    },
    {
      id: "acerte-imagem",
      title: "Acerte a Imagem",
      icon: ImageIcon,
      iconClassName: "text-pink-500",
      iconBackgroundClassName: "bg-pink-500/10",
      items: guessImageGames.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        imageUrl: g.thumbnail?.main_url,
        detail: `${g.sessions_count} sessão(ões)`,
        path: `/jogos/acerte-imagem/${g.id}`,
      })),
    },
  ], [stories, games, gamesV2, phonemeGames, auditoryGames, hangmanGames, wordSearchGames, spinWheelGames, cardGames, guessImageGames]);

  useEffect(() => {
    if (!userId || loading || !canTrackNew) return;
    const availableKeys = categories.flatMap(category => category.items.map(game => gameNoticeKey(category.id, game.id)));
    const next = reconcileGameNotices(readGameNotices(userId), availableKeys);
    saveGameNotices(userId, next);
    setPendingGameKeys(new Set(next.pending));
  }, [categories, canTrackNew, loading, userId]);

  const availableCategories = categories.filter(category => category.items.length > 0);
  const totalGames = categories.reduce((total, category) => total + category.items.length, 0);
  const activeCategory = searchParams.get("fechado") === "1"
    ? undefined
    : availableCategories.find(category => category.id === searchParams.get("tipo")) ?? availableCategories[0];

  useEffect(() => {
    const scroller = categoryScrollerRef.current;
    if (!scroller || loading) return;
    const updateScrollButtons = () => {
      setCanScrollLeft(scroller.scrollLeft > 1);
      setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    };
    updateScrollButtons();
    scroller.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);
    return () => {
      scroller.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [loading, availableCategories.length]);

  const selectCategory = (id: string) => {
    setSearchParams(activeCategory?.id === id ? { fechado: "1" } : { tipo: id });
  };

  const scrollCategories = (direction: -1 | 1) => {
    categoryScrollerRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  };

  const openGame = (categoryId: string, game: GameItem) => {
    if (userId) {
      const key = gameNoticeKey(categoryId, game.id);
      const stored = readGameNotices(userId) ?? { known: [], pending: [...pendingGameKeys] };
      const next = markGameOpened(stored, key);
      saveGameNotices(userId, next);
      setPendingGameKeys(new Set(next.pending));
    }
    navigate(game.path);
  };

  return (
    <div className="min-h-full py-6 lg:py-10">
      <div className="container mx-auto px-4">
        <header className="mb-6 sm:mb-8">
          <h1 className="inline-flex items-center gap-2 text-2xl lg:text-3xl font-display font-bold text-foreground">
            <Gamepad2 className="h-7 w-7 text-brand-green" />
            Jogos
          </h1>
          <p className="mt-1 text-muted-foreground">Jogos interativos para treinar habilidades com diversão</p>
        </header>

        {loading ? (
          <div className="flex flex-wrap gap-2" aria-label="Carregando jogos">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-36 rounded-md" />
            ))}
          </div>
        ) : totalGames === 0 ? (
          <div className="py-14 text-center">
            <Gamepad2 size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum jogo disponível ainda.</p>
          </div>
        ) : (
          <>
            <section aria-label="Tipos de jogos">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{totalGames} jogos disponíveis</p>
                {canScrollLeft || canScrollRight ? (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => scrollCategories(-1)} disabled={!canScrollLeft} aria-label="Categorias anteriores" title="Categorias anteriores" className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground disabled:opacity-35">
                      <ChevronLeft size={17} />
                    </button>
                    <button type="button" onClick={() => scrollCategories(1)} disabled={!canScrollRight} aria-label="Próximas categorias" title="Próximas categorias" className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground disabled:opacity-35">
                      <ChevronRight size={17} />
                    </button>
                  </div>
                ) : null}
              </div>
              <div ref={categoryScrollerRef} className="patient-game-categories flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
                {availableCategories.map(category => {
                  const selected = activeCategory?.id === category.id;
                  const hasNew = category.items.some(game => pendingGameKeys.has(gameNoticeKey(category.id, game.id)));
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => selectCategory(category.id)}
                      aria-pressed={selected}
                      className={`inline-flex min-h-11 flex-none snap-start items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${selected ? "border-brand-green bg-brand-green/10 text-brand-green" : "border-border bg-card text-foreground hover:border-brand-green/50 hover:bg-muted/30"} ${hasNew ? "patient-game-new" : ""}`}
                    >
                      <category.icon size={16} className={selected ? "text-brand-green" : category.iconClassName} aria-hidden="true" />
                      <span>{category.title}</span>
                      <span className="rounded-sm bg-foreground/5 px-1.5 py-0.5 text-[11px] font-bold">{category.items.length}</span>
                      {hasNew ? <span className="sr-only">Há jogos novos nesta categoria</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            {activeCategory ? (
              <section aria-labelledby="selected-game-category" className="mt-7 border-t border-border pt-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${activeCategory.iconBackgroundClassName}`}>
                    <activeCategory.icon className={`h-6 w-6 ${activeCategory.iconClassName}`} />
                  </div>
                  <div className="min-w-0">
                    <h2 id="selected-game-category" className="font-display text-lg font-bold text-foreground sm:text-xl">{activeCategory.title}</h2>
                    <p className="text-sm text-muted-foreground">{gameCount(activeCategory.items.length)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                  {activeCategory.items.map(game => {
                    const isNew = pendingGameKeys.has(gameNoticeKey(activeCategory.id, game.id));
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => openGame(activeCategory.id, game)}
                        className={`flex min-h-[132px] min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand-green/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${isNew ? "patient-game-new" : ""}`}
                      >
                        <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md ${activeCategory.iconBackgroundClassName}`}>
                          {game.imageUrl ? (
                            <img
                              src={normalizeMediaUrl(game.imageUrl)}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={event => { event.currentTarget.src = "/placeholder.svg"; }}
                            />
                          ) : (
                            <activeCategory.icon className={`h-6 w-6 ${activeCategory.iconClassName}`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{game.title}</h3>
                          {game.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p> : null}
                          <p className={`mt-2 text-xs font-semibold ${activeCategory.iconClassName}`}>
                            {game.detail}{isNew ? <span className="ml-2 text-brand-green">Novo</span> : null}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
