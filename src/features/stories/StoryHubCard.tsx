import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Info, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function StoryHubCard({ base }: { base: "/admin" | "/profissional" }) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <article className="flex h-full gap-3 rounded-lg border border-brand-green/30 bg-card p-5 sm:gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-green/10 text-brand-green">
        <BookOpen size={22} aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 font-display text-lg font-semibold">Histórias completas</h2>
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sobre histórias completas"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-brand-green hover:bg-brand-green/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setInfoOpen(true); }}
                onPointerLeave={(event) => { if (event.pointerType === "mouse") setInfoOpen(false); }}
              >
                <Info size={18} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" aria-label="Sobre histórias completas" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()} className="max-w-[calc(100vw-2rem)] p-3 text-sm leading-relaxed">
              Reúna slides, fotos, GIFs, vídeos e jogos na ordem que desejar para um atendimento completo. A sequência fica salva na sua biblioteca para usar e reutilizar, inclusive na transmissão ao vivo.
            </PopoverContent>
          </Popover>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Slides e jogos juntos em uma sequência salva para o atendimento.</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Button asChild><Link to={`${base}/jogos/historias`}>Gerenciar <ArrowRight size={17} className="ml-2" /></Link></Button>
          <Button asChild variant="outline"><Link to={`${base}/jogos/historias/novo`}><Plus size={17} className="mr-2" />Criar história</Link></Button>
        </div>
      </div>
    </article>
  );
}
