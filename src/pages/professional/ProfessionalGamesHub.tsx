import { useNavigate } from "react-router-dom";
import { Gamepad2, Ear, ArrowRight, Type, CircleDot, Grid3X3, Layers, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProfessionalGamesHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Jogos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Crie, edite e envie jogos apenas para seus pacientes.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-green" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Jogo da Memória</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crie, edite e atribua jogos de pares para seus pacientes.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/memoria")} variant="default" className="text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/memoria/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-green" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Jogo da Memória 2.0</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Você escolhe manualmente as 2 imagens de cada par.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/memoria2")} variant="default" className="text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/memoria2/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
                <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-purple" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Discriminação Fonema</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Fundo fixo + palavra + 2 imagens (certa/errada) por sessão.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/fonema")} variant="default" className="text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/fonema/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                <Ear className="h-5 w-5 sm:h-6 sm:w-6 text-brand-blue" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Estimulação Auditiva</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crie, edite e atribua jogos de arrastar para esquerda/direita.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/auditivo")} variant="default" className="bg-brand-blue hover:bg-brand-blue/90 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/auditivo/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
                <Type className="h-5 w-5 sm:h-6 sm:w-6 text-brand-orange" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Jogo da Forca</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crie jogos de palavra secreta com imagens de apoio.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/forca")} variant="default" className="bg-brand-orange hover:bg-brand-orange/90 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/forca/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <CircleDot className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Roleta Musical</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Crie roletas interativas com imagens e nomes.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/roleta")} variant="default" className="bg-amber-500 hover:bg-amber-600 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/roleta/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                <Grid3X3 className="h-5 w-5 sm:h-6 sm:w-6 text-brand-green" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Caça-palavras</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Grid com palavras escondidas e imagens correspondentes.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/caca-palavras")} variant="default" className="bg-brand-green hover:bg-brand-green/90 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/caca-palavras/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-brand-brown/10 flex items-center justify-center flex-shrink-0">
                <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-brand-brown" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Jogo das Cartas</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vire cartas do baralho e embaralhe quando quiser.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/cartas")} variant="default" className="bg-brand-brown hover:bg-brand-brown/90 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/cartas/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 shadow-sm h-full">
            <div className="flex items-start gap-3 sm:gap-4 h-full">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-pink-500" />
              </div>
              <div className="flex-1 flex flex-col h-full min-w-0">
                <h2 className="font-display font-bold text-foreground text-lg sm:text-xl">Acerte a Imagem</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Imagem revelada aos poucos com duas opções para escolher.</p>
                <div className="mt-auto pt-3 sm:pt-4 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
                  <Button onClick={() => navigate("/profissional/jogos/acerte-imagem")} variant="default" className="bg-pink-500 hover:bg-pink-600 text-xs sm:text-sm w-full sm:w-auto">
                    Gerenciar <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/profissional/jogos/acerte-imagem/novo")} variant="secondary" className="text-xs sm:text-sm w-full sm:w-auto">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

