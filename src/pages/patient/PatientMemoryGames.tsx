import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, Play, Image as ImageIcon, Ear, Type } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import type { MemoryGameRow, AuditoryGameRow, HangmanGameRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

export default function PatientMemoryGames() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MemoryGameRow[]>([]);
  const [auditoryGames, setAuditoryGames] = useState<AuditoryGameRow[]>([]);
  const [hangmanGames, setHangmanGames] = useState<HangmanGameRow[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [mem, aud, hang] = await Promise.all([
          api.userListMemoryGames(),
          api.userListAuditoryGames(),
          api.userListHangmanGames(),
        ]);
        if (!cancelled) {
          setGames(mem);
          setAuditoryGames(aud);
          setHangmanGames(hang);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2 inline-flex items-center gap-2">
            <Grid3X3 className="h-6 w-6 text-brand-green" />
            Jogos
          </h1>
          <p className="text-muted-foreground">
            Jogos interativos para treinar habilidades com diversão.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : games.length === 0 && auditoryGames.length === 0 && hangmanGames.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum jogo disponível ainda.
          </div>
        ) : (
          <div className="space-y-8">
            {auditoryGames.length > 0 && (
              <div>
                <h2 className="text-lg font-display font-bold text-foreground mb-3 inline-flex items-center gap-2">
                  <Ear className="h-5 w-5 text-brand-blue" />
                  Estimulação Auditiva
                </h2>
                <div className="space-y-4">
                  {auditoryGames.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => navigate(`/jogos/auditivo/${g.id}`)}
                      className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {g.background_url ? (
                            <img
                              src={normalizeMediaUrl(g.background_url)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <Ear size={22} className="text-brand-blue" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{g.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                          <div className="text-sm text-muted-foreground mt-2">
                            {g.items_count} imagens • arrastar para esquerda/direita
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                          <Play size={14} />
                          Jogar
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hangmanGames.length > 0 && (
              <div>
                <h2 className="text-lg font-display font-bold text-foreground mb-3 inline-flex items-center gap-2">
                  <Type className="h-5 w-5 text-brand-orange" />
                  Jogo da Forca
                </h2>
                <div className="space-y-4">
                  {hangmanGames.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => navigate(`/jogos/forca/${g.id}`)}
                      className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {g.thumbnail?.url ? (
                            <img
                              src={normalizeMediaUrl(g.thumbnail.url)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <Type size={22} className="text-brand-orange" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{g.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                          <div className="text-sm text-muted-foreground mt-2">
                            {g.word_length} letras • {g.support_images?.length ?? 0} imagem(ns)
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border bg-brand-orange/10 text-brand-orange border-brand-orange/20">
                          <Play size={14} />
                          Jogar
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {games.length > 0 && (
              <div>
                <h2 className="text-lg font-display font-bold text-foreground mb-3 inline-flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-brand-green" />
                  Jogo da Memória
                </h2>
                <div className="space-y-4">
                  {games.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => navigate(`/jogos/${g.id}`)}
                      className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {g.thumbnail ? (
                            <img
                              src={normalizeMediaUrl(g.thumbnail.url)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          ) : (
                            <ImageIcon size={22} className="text-primary" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">{g.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                          <div className="text-sm text-muted-foreground mt-2">
                            {g.pairs_count} pares • {g.cards.length} imagem(ns)
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border bg-brand-green/10 text-brand-green border-brand-green/20">
                          <Play size={14} />
                          Jogar
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


