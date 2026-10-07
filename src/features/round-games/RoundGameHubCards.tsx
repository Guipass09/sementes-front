import { ArrowRight, Ear, Images, Play, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { roundGameInfo } from "./round-game";

export default function RoundGameHubCards({ base }: { base: string }) {
  const navigate = useNavigate();
  return <>{(["sound", "sequence"] as const).map(kind => {
    const info = roundGameInfo[kind];
    const Icon = kind === "sound" ? Ear : Images;
    return <article key={kind} className="bg-card rounded-lg border border-border p-5 h-full flex gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${kind === "sound" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}><Icon size={22} /></div>
      <div className="flex flex-1 min-w-0 flex-col"><h2 className="font-display text-lg font-semibold">{info.title}</h2><p className="mt-1 text-sm text-muted-foreground">{info.description}</p><div className="mt-auto flex flex-wrap gap-2 pt-4"><Button onClick={() => navigate(`${base}/jogos/${info.slug}`)}>Gerenciar<ArrowRight size={17} className="ml-2" /></Button><Button variant="outline" onClick={() => navigate(`${base}/jogos/${info.slug}/novo`)}><Plus size={17} className="mr-2" />Criar</Button><Button variant="ghost" onClick={() => navigate(`/exemplos/${info.slug}`)}><Play size={16} className="mr-2" />Ver exemplo</Button></div></div>
    </article>;
  })}</>;
}
