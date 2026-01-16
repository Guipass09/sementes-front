import { useNavigate } from "react-router-dom";
import { Gamepad2, Ear, ArrowRight, Type, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminGamesHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Jogos</h1>
          <p className="text-muted-foreground">Gerencie os jogos do sistema por tipo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-brand-green/10 flex items-center justify-center">
                <Gamepad2 className="h-6 w-6 text-brand-green" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Jogo da Memória</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie, edite e atribua jogos de pares para os usuários.
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/memoria")} variant="default">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/memoria/novo")} variant="secondary">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-brand-green/10 flex items-center justify-center">
                <Gamepad2 className="h-6 w-6 text-brand-green" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Jogo da Memória 2.0</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Você escolhe manualmente as 2 imagens de cada par (sem duplicação automática).
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/memoria2")} variant="default">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/memoria2/novo")} variant="secondary">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center">
                <Gamepad2 className="h-6 w-6 text-brand-purple" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Discriminação Fonema</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Fundo fixo + palavra com áudio + 2 imagens (certa/errada) por sessão.
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/fonema")} variant="default">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/fonema/novo")} variant="secondary">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
                <Ear className="h-6 w-6 text-brand-blue" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Estimulação Auditiva</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie, edite e atribua jogos de arrastar para esquerda/direita.
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/auditivo")} variant="default" className="bg-brand-blue hover:bg-brand-blue/90">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/auditivo/novo")} variant="secondary">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                <Type className="h-6 w-6 text-brand-orange" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Jogo da Forca</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie jogos de palavra secreta com imagens de apoio e teclado A‑Z.
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/forca")} variant="default" className="bg-brand-orange hover:bg-brand-orange/90">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/forca/novo")} variant="secondary">
                    Novo jogo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
            <div className="flex items-start gap-4 h-full">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <CircleDot className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1 flex flex-col h-full">
                <h2 className="font-display font-bold text-foreground text-xl">Roleta Musical</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie roletas interativas com imagens e nomes para cantar músicas.
                </p>
                <div className="mt-auto pt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={() => navigate("/admin/jogos/roleta")} variant="default" className="bg-amber-500 hover:bg-amber-600">
                    Gerenciar <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={() => navigate("/admin/jogos/roleta/novo")} variant="secondary">
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


