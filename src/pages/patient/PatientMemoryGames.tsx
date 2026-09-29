import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleDot,
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

export default function PatientMemoryGames() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MemoryGameRow[]>([]);
  const [gamesV2, setGamesV2] = useState<MemoryGameRow[]>([]);
  const [phonemeGames, setPhonemeGames] = useState<PhonemeGameRow[]>([]);
  const [auditoryGames, setAuditoryGames] = useState<AuditoryGameRow[]>([]);
  const [hangmanGames, setHangmanGames] = useState<HangmanGameRow[]>([]);
  const [spinWheelGames, setSpinWheelGames] = useState<SpinWheelGameRow[]>([]);
  const [wordSearchGames, setWordSearchGames] = useState<WordSearchGameRow[]>([]);
  const [cardGames, setCardGames] = useState<CardGameRow[]>([]);
  const [guessImageGames, setGuessImageGames] = useState<GuessImageGameRow[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [memClassic, memV2, phon, aud, hang, spin, ws, cards, guessImg] = await Promise.all([
          api.userListMemoryGames({ variant: "classic" }).catch(err => {
            console.error("[Jogos] Erro ao buscar memory games:", err);
            return [];
          }),
          api.userListMemoryGames({ variant: "v2" }).catch(err => {
            console.error("[Jogos] Erro ao buscar memory games v2:", err);
            return [];
          }),
          api.userListPhonemeGames().catch(err => {
            console.error("[Jogos] Erro ao buscar phoneme games:", err);
            return [];
          }),
          api.userListAuditoryGames().catch(err => {
            console.error("[Jogos] Erro ao buscar auditory games:", err);
            return [];
          }),
          api.userListHangmanGames().catch(err => {
            console.error("[Jogos] Erro ao buscar hangman games:", err);
            return [];
          }),
          api.userListSpinWheelGames().catch(err => {
            console.error("[Jogos] Erro ao buscar spin wheel games:", err);
            return [];
          }),
          api.userListWordSearchGames().catch(err => {
            console.error("[Jogos] Erro ao buscar word search games:", err);
            return [];
          }),
          api.userListCardGames().catch(err => {
            console.error("[Jogos] Erro ao buscar card games:", err);
            return [];
          }),
          api.userListGuessImageGames().catch(err => {
            console.error("[Jogos] Erro ao buscar guess image games:", err);
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const categories: GameCategory[] = [
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
  ];

  const availableCategories = categories.filter(category => category.items.length > 0);
  const totalGames = categories.reduce((total, category) => total + category.items.length, 0);
  const activeCategory = availableCategories.find(category => category.id === searchParams.get("tipo"));

  const selectCategory = (id: string) => {
    setSearchParams({ tipo: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showCategories = () => {
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" aria-label="Carregando jogos">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-[178px] rounded-lg border border-border bg-card p-4">
                <Skeleton className="h-14 w-14 rounded-md" />
                <Skeleton className="mt-5 h-4 w-4/5" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : totalGames === 0 ? (
          <div className="py-14 text-center">
            <Gamepad2 size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum jogo disponível ainda.</p>
          </div>
        ) : activeCategory ? (
          <section aria-labelledby="selected-game-category">
            <button
              type="button"
              onClick={showCategories}
              className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              <ArrowLeft size={18} />
              Todos os jogos
            </button>
            <div className="mb-5 flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${activeCategory.iconBackgroundClassName}`}>
                <activeCategory.icon className={`h-6 w-6 ${activeCategory.iconClassName}`} />
              </div>
              <div className="min-w-0">
                <h2 id="selected-game-category" className="font-display text-xl font-bold text-foreground sm:text-2xl">
                  {activeCategory.title}
                </h2>
                <p className="text-sm text-muted-foreground">{gameCount(activeCategory.items.length)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
              {activeCategory.items.map(game => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => navigate(game.path)}
                  className="group flex min-h-[126px] min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand-green/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
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
                      <activeCategory.icon className={`h-7 w-7 ${activeCategory.iconClassName}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">{game.title}</h3>
                    {game.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p> : null}
                    <p className={`mt-2 text-xs font-semibold ${activeCategory.iconClassName}`}>{game.detail}</p>
                  </div>
                  <ArrowUpRight size={17} className="shrink-0 text-muted-foreground transition-colors group-hover:text-brand-green" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section aria-label="Tipos de jogos">
            <p className="mb-4 text-sm text-muted-foreground">{totalGames} jogos disponíveis</p>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {availableCategories.map(category => {
                const preview = category.items.find(item => item.imageUrl)?.imageUrl;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => selectCategory(category.id)}
                    className="group flex min-h-[176px] min-w-0 flex-col rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand-green/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md ${category.iconBackgroundClassName}`}>
                        {preview ? (
                          <img
                            src={normalizeMediaUrl(preview)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={event => { event.currentTarget.src = "/placeholder.svg"; }}
                          />
                        ) : (
                          <category.icon className={`h-7 w-7 ${category.iconClassName}`} />
                        )}
                      </div>
                      <ArrowUpRight size={17} className="shrink-0 text-muted-foreground transition-colors group-hover:text-brand-green" aria-hidden="true" />
                    </div>
                    <div className="mt-auto min-w-0 pt-4">
                      <h2 className="font-display text-sm font-bold leading-snug text-foreground sm:text-base">{category.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{gameCount(category.items.length)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
