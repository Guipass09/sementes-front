import { useEffect, useMemo, useState } from "react";
import {
  CircleDot,
  Ear,
  FileText,
  Gamepad2,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  Search,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ClinicProfessionalScopeSelector from "@/components/ClinicProfessionalScopeSelector";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import * as api from "@/lib/laravel-api";

type GameSection = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  items: Array<Record<string, any>>;
};

export default function ClinicProfessionalGamesView(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<api.ClinicProfessionalRow[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sections, setSections] = useState<GameSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    setProfessionalsLoading(true);
    void api
      .clinicListProfessionals()
      .then((res) => {
        if (cancelled) return;
        setProfessionals(res.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setProfessionals([]);
      })
      .finally(() => {
        if (!cancelled) setProfessionalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (professionals.length === 0) {
      setSelectedProfessionalId(null);
      return;
    }

    if (selectedProfessionalId === null || !professionals.some((professional) => professional.id === selectedProfessionalId)) {
      setSelectedProfessionalId(professionals[0].id);
    }
  }, [professionals, selectedProfessionalId]);

  useEffect(() => {
    if (!selectedProfessionalId) {
      setSections([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      api.professionalListMemoryGames({ professional_user_id: selectedProfessionalId, variant: "classic" }),
      api.professionalListMemoryGames({ professional_user_id: selectedProfessionalId, variant: "v2" }),
      api.professionalListPhonemeGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListAuditoryGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListHangmanGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListSpinWheelGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListWordSearchGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListCardGames({ professional_user_id: selectedProfessionalId }),
      api.professionalListGuessImageGames({ professional_user_id: selectedProfessionalId }),
    ])
      .then(([memoryClassic, memoryV2, phonemeGames, auditoryGames, hangmanGames, spinWheelGames, wordSearchGames, cardGames, guessImageGames]) => {
        if (cancelled) return;
        setSections([
          {
            key: "memory-classic",
            title: "Jogo da Memória",
            description: "Jogos clássicos de pares cadastrados pelo terapeuta.",
            icon: Gamepad2,
            iconClassName: "text-brand-green bg-brand-green/10",
            items: memoryClassic ?? [],
          },
          {
            key: "memory-v2",
            title: "Jogo da Memória 2.0",
            description: "Versão com seleção manual das imagens de cada par.",
            icon: Gamepad2,
            iconClassName: "text-brand-green bg-brand-green/10",
            items: memoryV2 ?? [],
          },
          {
            key: "phoneme",
            title: "Discriminação Fonema",
            description: "Sessões fonológicas vinculadas ao contexto do terapeuta.",
            icon: Gamepad2,
            iconClassName: "text-brand-purple bg-brand-purple/10",
            items: phonemeGames ?? [],
          },
          {
            key: "auditory",
            title: "Estimulação Auditiva",
            description: "Jogos auditivos criados e compartilhados com os pacientes dele.",
            icon: Ear,
            iconClassName: "text-brand-blue bg-brand-blue/10",
            items: auditoryGames ?? [],
          },
          {
            key: "hangman",
            title: "Jogo da Forca",
            description: "Jogos de palavra secreta disponíveis no vínculo desse profissional.",
            icon: Type,
            iconClassName: "text-brand-orange bg-brand-orange/10",
            items: hangmanGames ?? [],
          },
          {
            key: "spin-wheel",
            title: "Roleta Musical",
            description: "Roletas interativas vinculadas ao terapeuta selecionado.",
            icon: CircleDot,
            iconClassName: "text-amber-500 bg-amber-500/10",
            items: spinWheelGames ?? [],
          },
          {
            key: "word-search",
            title: "Caça-palavras",
            description: "Jogos de busca de palavras e imagens do terapeuta.",
            icon: Grid3X3,
            iconClassName: "text-brand-green bg-brand-green/10",
            items: wordSearchGames ?? [],
          },
          {
            key: "card-game",
            title: "Jogo das Cartas",
            description: "Baralhos terapêuticos usados pelo profissional.",
            icon: Layers,
            iconClassName: "text-brand-brown bg-brand-brown/10",
            items: cardGames ?? [],
          },
          {
            key: "guess-image",
            title: "Acerte a Imagem",
            description: "Sessões de imagem revelada por etapas ligadas ao terapeuta.",
            icon: ImageIcon,
            iconClassName: "text-pink-500 bg-pink-500/10",
            items: guessImageGames ?? [],
          },
        ]);
      })
      .catch(() => {
        if (cancelled) return;
        setSections([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProfessionalId]);

  const filteredSections = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          [item.title, item.description ?? "", ...(item.assigned_to?.map((patient: { name: string }) => patient.name) ?? [])]
            .join(" ")
            .toLowerCase()
            .includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, searchTerm]);

  const selectedProfessionalName = useMemo(
    () => professionals.find((professional) => professional.id === selectedProfessionalId)?.name ?? "",
    [professionals, selectedProfessionalId]
  );

  const totalGames = useMemo(() => sections.reduce((sum, section) => sum + section.items.length, 0), [sections]);

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Jogos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Acompanhe os jogos da clínica separados por terapeuta e por tipo de recurso.
            </p>
          </div>

          {professionalsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {[0, 1].map((item) => (
                <div key={item} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-4 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <ClinicProfessionalScopeSelector
              professionals={professionals}
              selectedProfessionalId={selectedProfessionalId}
              onSelect={setSelectedProfessionalId}
              title="Escolha o terapeuta"
              description="Clique em um profissional para ver os jogos vinculados ao contexto dele."
            />
          )}
        </div>

        {selectedProfessionalName ? (
          <div className="mb-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            Exibindo jogos de: <span className="font-semibold text-foreground">{selectedProfessionalName}</span>
            {totalGames > 0 ? (
              <span className="ml-2 inline-flex rounded-full bg-brand-green/10 px-2.5 py-1 text-xs text-brand-green">
                {totalGames} jogo(s)
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] sm:w-5 sm:h-5" />
            <Input
              type="text"
              placeholder="Buscar por jogo, descrição ou paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 sm:pl-11 text-sm sm:text-base"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <Skeleton className="h-5 w-1/3 mb-3" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : professionals.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum terapeuta vinculado à clínica ainda.</p>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum jogo encontrado para este terapeuta.</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-3 sm:space-y-4">
            {filteredSections.map((section) => {
              const SectionIcon = section.icon;
              return (
                <AccordionItem key={section.key} value={section.key} className="rounded-xl border border-border bg-card px-4">
                  <AccordionTrigger className="py-4 text-left">
                    <div className="flex w-full items-start justify-between gap-3 pr-2">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${section.iconClassName}`}>
                          <SectionIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{section.title}</div>
                          <div className="text-xs text-muted-foreground">{section.description}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">{section.items.length} jogo(s)</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {section.items.map((item) => (
                        <GameCard key={`${section.key}-${item.id}`} sectionKey={section.key} item={item} iconClassName={section.iconClassName} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}

function GameCard(props: {
  sectionKey: string;
  item: Record<string, any>;
  iconClassName: string;
}): JSX.Element {
  const { sectionKey, item, iconClassName } = props;
  const thumbnailUrl = getThumbnailUrl(sectionKey, item);
  const metricLabel = getMetricLabel(sectionKey, item);
  const assignedNames = (item.assigned_to ?? []).map((patient: { name: string }) => patient.name).slice(0, 3);
  const extraAssignedCount = Math.max(0, (item.assigned_to?.length ?? 0) - assignedNames.length);

  return (
    <div className="rounded-xl border border-border bg-background/70 p-4 shadow-sm">
      <div className="flex gap-3">
        <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl ${iconClassName} flex-shrink-0`}>
          {thumbnailUrl ? (
            <img src={normalizeMediaUrl(thumbnailUrl)} alt="" className="h-full w-full object-cover" />
          ) : (
            <Gamepad2 className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{item.title}</h3>
            {metricLabel ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{metricLabel}</span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {assignedNames.map((name: string) => (
              <span key={name} className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs text-brand-green">
                {name}
              </span>
            ))}
            {extraAssignedCount > 0 ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                +{extraAssignedCount} paciente(s)
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMetricLabel(sectionKey: string, item: Record<string, any>): string {
  switch (sectionKey) {
    case "memory-classic":
    case "memory-v2":
      return `${item.pairs_count ?? 0} pares`;
    case "phoneme":
    case "guess-image":
      return `${item.sessions_count ?? 0} sessões`;
    case "auditory":
    case "spin-wheel":
      return `${item.items_count ?? 0} itens`;
    case "hangman":
      return `${item.word_length ?? 0} letras`;
    case "word-search":
      return `${item.words_count ?? 0} palavras`;
    case "card-game":
      return `${item.cards_count ?? 0} cartas`;
    default:
      return "";
  }
}

function getThumbnailUrl(sectionKey: string, item: Record<string, any>): string | null {
  switch (sectionKey) {
    case "memory-classic":
    case "memory-v2":
      return item.thumbnail?.url ?? null;
    case "phoneme":
      return item.thumbnail?.left_url ?? item.thumbnail?.right_url ?? null;
    case "auditory":
      return item.thumbnail?.url ?? null;
    case "hangman":
      return item.thumbnail?.url ?? null;
    case "spin-wheel":
      return item.thumbnail?.url ?? item.items?.[0]?.image_url ?? null;
    case "word-search":
      return item.items?.[0]?.image_url ?? null;
    case "card-game":
      return item.cards?.[0]?.url ?? null;
    case "guess-image":
      return item.thumbnail?.main_url ?? null;
    default:
      return null;
  }
}
