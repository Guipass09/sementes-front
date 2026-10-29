import { Fragment } from "react";
import type { GameRound } from "@/lib/laravel-api";
import { sentenceParts } from "./round-game";

export function SentencePrompt({ round, selected = [], preview = false }: { round: GameRound; selected?: string[]; preview?: boolean }) {
  const parts = sentenceParts(round.prompt);
  return <div className={`sentence-prompt ${preview ? "sentence-prompt--preview" : ""}`} aria-label={preview ? "Prévia da frase" : "Frase da rodada"}>
    {parts.map((part, i) => <Fragment key={i}>
      <span>{part}</span>
      {i < parts.length - 1 && <span
        className={`sentence-blank ${selected[i] ? "sentence-blank--filled" : i === selected.length ? "sentence-blank--active" : ""}`}
        aria-label={selected[i] ? `Lacuna ${i + 1}: ${round.choices.find(c => c.id === selected[i])?.label || ""}` : `Lacuna ${i + 1}, ${i === selected.length ? "sua vez" : "aguardando"}`}
        aria-current={!preview && i === selected.length ? "step" : undefined}
      >{selected[i] ? round.choices.find(c => c.id === selected[i])?.label : <><span aria-hidden="true">___</span><small aria-hidden="true">{i + 1}</small></>}</span>}
    </Fragment>)}
  </div>;
}
