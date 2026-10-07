import type { RoundChoice, RoundGameKind, RoundGameRow } from "../../lib/laravel-api.ts";

const figure = (id: string, label: string, correct = false): RoundChoice => ({
  id, label, correct, path: `games/examples/${id}.png`, url: `/games/examples/${id}.png`,
});
const words = [figure("sol", "Sol"), figure("bola", "Bola"), figure("sapo", "Sapo"), figure("flor", "Flor")];
const moments = [figure("plantar", "Plantar a semente"), figure("regar", "Regar a plantinha"), figure("crescer", "Ver a flor crescer")];
const common = {
  description: "", background_color: "#ffffff", background_path: null, background_url: null,
  created_by: { id: 0, name: "Sementes da Fala", role: "admin" }, can_edit: false, assigned_to: [],
};

export const roundGameExamples: Record<RoundGameKind, RoundGameRow> = {
  sound: {
    ...common, id: 0, kind: "sound", title: "Descubra os sons do jardim",
    thumbnail: { url: "/games/examples/sol.png" },
    rounds: [
      { id: "som-s", prompt: "Quais palavras começam com o som /s/?", choices: words.map(c => ({ ...c, correct: c.id === "sol" || c.id === "sapo" })) },
      { id: "som-b", prompt: "Qual palavra começa com o som /b/?", choices: words.map(c => ({ ...c, correct: c.id === "bola" })) },
      { id: "som-f", prompt: "Qual palavra começa com o som /f/?", choices: words.map(c => ({ ...c, correct: c.id === "flor" })) },
    ],
  },
  sequence: {
    ...common, id: 0, kind: "sequence", title: "Uma história no jardim",
    thumbnail: { url: "/games/examples/plantar.png" },
    rounds: [
      { id: "historia-completa", prompt: "Como a flor cresceu? Escolha as figuras na ordem dos acontecimentos.", choices: moments },
      { id: "depois-de-plantar", prompt: "A semente já foi plantada. O que vem depois?", choices: moments.slice(1) },
    ],
  },
};
