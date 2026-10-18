import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clock3, Gamepad2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { usePatientLibrary, type PatientGameItem as GameItem, type PatientGameCategory } from "@/features/patient-library/usePatientLibrary";
import { newestFirst } from "@/features/patient-library/recent-content";
import { gameNoticeKey, markGameOpened, reconcileGameNotices, readGameNotices, saveGameNotices } from "./game-notices";
import "./patient-games.css";

const gameCount = (count: number) => `${count} ${count === 1 ? "jogo disponível" : "jogos disponíveis"}`;

export default function PatientMemoryGames() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [pendingGameKeys, setPendingGameKeys] = useState<Set<string>>(() => new Set());
  const { categories, loading, hasErrors, refresh } = usePatientLibrary();
  const canTrackNew = !hasErrors;
  useEffect(() => {
    if (!userId || auth.user?.role !== "user" || loading || !canTrackNew) return;
    const availableKeys = categories.flatMap(category => category.items.map(game => gameNoticeKey(category.id, game.id)));
    const next = reconcileGameNotices(readGameNotices(userId), availableKeys);
    saveGameNotices(userId, next);
    setPendingGameKeys(new Set(next.pending));
  }, [categories, canTrackNew, loading, userId]);

  const availableCategories = categories.filter(category => category.items.length > 0);
  const totalGames = categories.reduce((total, category) => total + category.items.length, 0);
  const recentCategory: PatientGameCategory = {
    id: "recentes", title: "Jogos recentes", icon: Clock3,
    iconClassName: "text-brand-green", iconBackgroundClassName: "bg-brand-green/10",
    items: newestFirst(categories.flatMap(category => category.items.map(game => ({ ...game, categoryId: category.id }))), game => game.createdAt).slice(0, 12),
  };
  const requestedCategory = searchParams.get("tipo");
  const activeCategory = searchParams.get("recentes") === "1" ? recentCategory : searchParams.get("fechado") === "1"
    ? undefined
    : requestedCategory ? categories.find(category => category.id === requestedCategory) : availableCategories[0];

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
    setSearchParams(activeCategory?.id === id ? { fechado: "1" } : id === "recentes" ? { recentes: "1" } : { tipo: id });
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

        {hasErrors && (
          <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span>Alguns jogos não puderam ser carregados.</span>
            <button type="button" onClick={() => void refresh()} className="font-semibold text-primary underline underline-offset-4">Tentar novamente</button>
          </div>
        )}

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
                <button type="button" onClick={() => selectCategory("recentes")} aria-pressed={activeCategory?.id === "recentes"} className={`inline-flex min-h-11 flex-none items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${activeCategory?.id === "recentes" ? "border-brand-green bg-brand-green/10 text-brand-green" : "border-border bg-card text-foreground hover:bg-muted/30"}`}>
                  <Clock3 size={16} /> Recentes
                </button>
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
                {!activeCategory.items.length && <p className="py-8 text-sm text-muted-foreground">Nenhum jogo desta categoria está disponível para você no momento.</p>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
                  {activeCategory.items.map(game => {
                    const categoryId = game.categoryId ?? activeCategory.id;
                    const isNew = pendingGameKeys.has(gameNoticeKey(categoryId, game.id));
                    return (
                      <button
                        key={`${categoryId}-${game.id}`}
                        type="button"
                        onClick={() => openGame(categoryId, game)}
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
