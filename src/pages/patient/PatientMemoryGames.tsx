import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Grid3X3, Play, Image as ImageIcon, Ear, Type, ChevronDown, Gamepad2, CircleDot, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import type { MemoryGameRow, AuditoryGameRow, HangmanGameRow, SpinWheelGameRow, PhonemeGameRow, WordSearchGameRow, CardGameRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function PatientMemoryGames() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MemoryGameRow[]>([]);
  const [gamesV2, setGamesV2] = useState<MemoryGameRow[]>([]);
  const [phonemeGames, setPhonemeGames] = useState<PhonemeGameRow[]>([]);
  const [auditoryGames, setAuditoryGames] = useState<AuditoryGameRow[]>([]);
  const [hangmanGames, setHangmanGames] = useState<HangmanGameRow[]>([]);
  const [spinWheelGames, setSpinWheelGames] = useState<SpinWheelGameRow[]>([]);
  const [wordSearchGames, setWordSearchGames] = useState<WordSearchGameRow[]>([]);
  const [cardGames, setCardGames] = useState<CardGameRow[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [memClassic, memV2, phon, aud, hang, spin, ws, cards] = await Promise.all([
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
        ]);
        if (!cancelled) {
          console.log("[Jogos] Resultados:", {
            mem: memClassic.length,
            mem2: memV2.length,
            phon: phon.length,
            aud: aud.length,
            hang: hang.length,
            spin: spin.length,
            ws: ws.length,
          });
          setGames(memClassic);
          setGamesV2(memV2);
          setPhonemeGames(phon);
          setAuditoryGames(aud);
          setHangmanGames(hang);
          setSpinWheelGames(spin);
          setWordSearchGames(ws);
          setCardGames(cards);
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.user]);

  const totalGames =
    games.length +
    gamesV2.length +
    phonemeGames.length +
    auditoryGames.length +
    hangmanGames.length +
    spinWheelGames.length +
    wordSearchGames.length +
    cardGames.length;

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2 inline-flex items-center gap-2">
            <Gamepad2 className="h-7 w-7 text-brand-green" />
            Jogos
          </h1>
          <p className="text-muted-foreground">
            Jogos interativos para treinar habilidades com diversão
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-sm">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-green"></div>
              <span className="text-muted-foreground">Jogos da Memória:</span>
              <span className="font-semibold text-foreground">{games.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-green/60"></div>
              <span className="text-muted-foreground">Memória 2.0:</span>
              <span className="font-semibold text-foreground">{gamesV2.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-purple"></div>
              <span className="text-muted-foreground">Discriminação Fonema:</span>
              <span className="font-semibold text-foreground">{phonemeGames.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-blue"></div>
              <span className="text-muted-foreground">Estimulação Auditiva:</span>
              <span className="font-semibold text-foreground">{auditoryGames.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-orange"></div>
              <span className="text-muted-foreground">Jogo da Forca:</span>
              <span className="font-semibold text-foreground">{hangmanGames.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-muted-foreground">Roleta:</span>
              <span className="font-semibold text-foreground">{spinWheelGames.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-brand-brown"></div>
              <span className="text-muted-foreground">Jogo das Cartas:</span>
              <span className="font-semibold text-foreground">{cardGames.length}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-foreground">{totalGames} jogos</span>
            </div>
          </div>
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
        ) : totalGames === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm text-center">
            <Gamepad2 size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum jogo disponível ainda.</p>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={["memoria", "memoria2", "fonema", "auditivo", "forca", "roleta", "cartas"]} className="space-y-4">
            {/* Jogos da Memória */}
            {games.length > 0 && (
              <AccordionItem value="memoria" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                      <Grid3X3 className="h-5 w-5 text-brand-green" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">
                        Jogos da Memória
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {games.length} jogo{games.length !== 1 ? "s" : ""} disponível{games.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {games.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-green/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <ImageIcon size={24} className="text-brand-green" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-green font-medium">{g.pairs_count} pares</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Jogos da Memória 2.0 */}
            {gamesV2.length > 0 && (
              <AccordionItem value="memoria2" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                      <Grid3X3 className="h-5 w-5 text-brand-green" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">Memória 2.0</h2>
                      <p className="text-sm text-muted-foreground">
                        {gamesV2.length} jogo{gamesV2.length !== 1 ? "s" : ""} disponível{gamesV2.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {gamesV2.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/memoria2/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-green/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <ImageIcon size={24} className="text-brand-green" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-green font-medium">{g.pairs_count} pares</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Discriminação Fonema */}
            {phonemeGames.length > 0 && (
              <AccordionItem value="fonema" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center">
                      <Ear className="h-5 w-5 text-brand-purple" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">Discriminação Fonema</h2>
                      <p className="text-sm text-muted-foreground">
                        {phonemeGames.length} jogo{phonemeGames.length !== 1 ? "s" : ""} disponível{phonemeGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {phonemeGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/fonema/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-purple/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-purple/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {g.thumbnail?.left_url ? (
                              <img
                                src={normalizeMediaUrl(g.thumbnail.left_url)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            ) : (
                              <Ear size={24} className="text-brand-purple" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-purple font-medium">{g.sessions_count} sessões</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Estimulação Auditiva */}
            {auditoryGames.length > 0 && (
              <AccordionItem value="auditivo" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                      <Ear className="h-5 w-5 text-brand-blue" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">
                        Estimulação Auditiva
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {auditoryGames.length} jogo{auditoryGames.length !== 1 ? "s" : ""} disponível{auditoryGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {auditoryGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/auditivo/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-blue/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <Ear size={24} className="text-brand-blue" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-blue font-medium">{g.items_count} imagens</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Jogo da Forca */}
            {hangmanGames.length > 0 && (
              <AccordionItem value="forca" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                      <Type className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">
                        Jogo da Forca
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {hangmanGames.length} jogo{hangmanGames.length !== 1 ? "s" : ""} disponível{hangmanGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {hangmanGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/forca/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-orange/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <Type size={24} className="text-brand-orange" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-orange font-medium">{g.word_length} letras</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Roleta Musical */}
            {spinWheelGames.length > 0 && (
              <AccordionItem value="roleta" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <CircleDot className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">
                        Roleta Musical
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {spinWheelGames.length} jogo{spinWheelGames.length !== 1 ? "s" : ""} disponível{spinWheelGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {spinWheelGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/roleta/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-amber-500/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <CircleDot size={24} className="text-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {g.center_title || "Gire a roleta!"}
                            </p>
                            <span className="text-xs text-amber-500 font-medium">{g.items_count} itens</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Caça-palavras */}
            {wordSearchGames.length > 0 && (
              <AccordionItem value="caca-palavras" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center">
                      <Grid3X3 className="h-5 w-5 text-brand-green" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">Caça-palavras</h2>
                      <p className="text-sm text-muted-foreground">
                        {wordSearchGames.length} jogo{wordSearchGames.length !== 1 ? "s" : ""} disponível{wordSearchGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {wordSearchGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/caca-palavras/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-green/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {g.items?.[0]?.image_url ? (
                              <img
                                src={normalizeMediaUrl(g.items[0].image_url)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            ) : (
                              <Grid3X3 size={24} className="text-brand-green" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-green font-medium">{g.words_count} palavra(s)</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Jogo das Cartas */}
            {cardGames.length > 0 && (
              <AccordionItem value="cartas" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-brown/10 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-brand-brown" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-display font-bold text-foreground">Jogo das Cartas</h2>
                      <p className="text-sm text-muted-foreground">
                        {cardGames.length} jogo{cardGames.length !== 1 ? "s" : ""} disponível{cardGames.length !== 1 ? "is" : ""}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {cardGames.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => navigate(`/jogos/cartas/${g.id}`)}
                        className="text-left bg-background rounded-xl border border-border p-4 hover:shadow-md hover:border-brand-brown/30 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-brown/40"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-brand-brown/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <Layers size={24} className="text-brand-brown" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{g.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{g.description}</p>
                            <span className="text-xs text-brand-brown font-medium">{g.cards_count} carta(s)</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </div>
    </div>
  );
}
