import { ArrowLeft, Ear, Images } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoundGameKind } from "@/lib/laravel-api";
import logo from "@/assets/logo-sementes-da-fala.jpg";
import { RoundGameBoard } from "./RoundGameView";
import { roundGameInfo } from "./round-game";
import { roundGameExamples } from "./round-game-examples";

export default function RoundGameExample({ kind }: { kind: RoundGameKind }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const game = roundGameExamples[kind];
  const back = user?.role === "admin" ? "/admin/jogos" : user?.role === "professional" ? "/profissional/jogos" : "/#experiencia";

  return <div className="round-game-page">
    <header className="round-game-header">
      <Button asChild variant="ghost" size="icon"><Link to={back} title="Voltar" aria-label="Voltar"><ArrowLeft size={20} /></Link></Button>
      <img src={logo} alt="Sementes da Fala" />
      <div><span>Exemplo de jogo</span><h1>{game.title}</h1></div>
    </header>
    <main className="round-game-main">
      <Tabs value={kind} onValueChange={value => navigate(`/exemplos/${roundGameInfo[value as RoundGameKind].slug}`)} className="mb-5">
        <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 items-stretch" aria-label="Exemplos de jogos">
          <TabsTrigger value="sound" className="min-h-11 min-w-0 gap-2 whitespace-normal leading-4"><Ear size={17} className="shrink-0" aria-hidden="true" /><span>Sons e imagens</span></TabsTrigger>
          <TabsTrigger value="sequence" className="min-h-11 min-w-0 gap-2 whitespace-normal leading-4"><Images size={17} className="shrink-0" aria-hidden="true" /><span>Sequência de imagens</span></TabsTrigger>
        </TabsList>
      </Tabs>
      <RoundGameBoard key={kind} game={game} seed={23} />
    </main>
  </div>;
}
