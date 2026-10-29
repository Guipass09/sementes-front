export type ResourceNavLink = { path: string; label: string };

export const GAME_DESTINATIONS = [
  { slug: "historias", label: "Histórias completas", clinicKey: "stories" },
  { slug: "sons-imagens", label: "Sons e imagens", clinicKey: "sound" },
  { slug: "sequencia-imagens", label: "Sequência de imagens", clinicKey: "sequence" },
  { slug: "complete-frase", label: "Complete a frase", clinicKey: "sentence" },
  { slug: "memoria", label: "Memória", clinicKey: "memory-classic" },
  { slug: "memoria2", label: "Memória 2.0", clinicKey: "memory-v2" },
  { slug: "fonema", label: "Discriminação de fonemas", clinicKey: "phoneme" },
  { slug: "auditivo", label: "Estimulação auditiva", clinicKey: "auditory" },
  { slug: "forca", label: "Forca", clinicKey: "hangman" },
  { slug: "roleta", label: "Roleta musical", clinicKey: "spin-wheel" },
  { slug: "caca-palavras", label: "Caça-palavras", clinicKey: "word-search" },
  { slug: "cartas", label: "Jogo das cartas", clinicKey: "card-game" },
  { slug: "acerte-imagem", label: "Acerte a imagem", clinicKey: "guess-image" },
] as const;

export function resourceNavigation(base: string, options: { patient?: boolean; clinic?: boolean; preview?: boolean } = {}) {
  const activities: ResourceNavLink[] = [{ path: `${base}/atividades`, label: "Todas as atividades" }];
  const games: ResourceNavLink[] = [{ path: `${base}/jogos`, label: "Todos os jogos" }];
  if (options.preview && !options.patient) return { activities, games };
  if (!options.patient && !options.clinic) {
    activities.push({ path: `${base}/pastas`, label: "Minhas pastas" });
    games.push({ path: `${base}/pastas`, label: "Minhas pastas" });
  }

  activities.push(...(options.patient ? [
    { path: `${base}/atividades?ordem=recentes`, label: "Mais recentes" },
    { path: `${base}/atividades?status=em_andamento`, label: "Em andamento" },
    { path: `${base}/atividades?status=concluida`, label: "Concluídas" },
  ] : [
    { path: `${base}/atividades?visao=biblioteca`, label: "Biblioteca" },
    { path: `${base}/atividades?visao=pacientes`, label: "Por paciente" },
  ]));
  if (options.patient) games.push({ path: `${base}/jogos?recentes=1`, label: "Mais recentes" });
  games.push(...GAME_DESTINATIONS.map(item => ({
    label: item.label,
    path: options.patient
      ? `${base}/jogos?tipo=${item.slug}`
      : options.clinic ? `${base}/jogos?tipo=${item.clinicKey}` : `${base}/jogos/${item.slug}`,
  })));
  if (!options.patient) games.push({ path: `${base}/jogos/boca-3d`, label: "Boca 3D" });
  return { activities, games };
}

export function isResourceLinkActive(path: string, pathname: string, search: string): boolean {
  const target = new URL(path, "https://navigation.local");
  if (target.pathname !== pathname && !pathname.startsWith(`${target.pathname}/`)) return false;
  if (target.pathname !== pathname) return !target.pathname.endsWith("/jogos");
  const current = new URLSearchParams(search);
  if (target.searchParams.size) {
    return [...target.searchParams].every(([key, value]) => current.get(key) === value);
  }
  return !["tipo", "recentes", "fechado", "visao", "status", "ordem"].some(key => current.has(key));
}
