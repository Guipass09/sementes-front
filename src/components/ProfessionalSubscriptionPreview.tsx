import { useState } from "react";
import { Activity, ArrowRight, CalendarDays, Check, FileText, Gamepad2, History, LockKeyhole, RefreshCw, Users, Video, Wallet } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const previews = {
  dashboard: {
    label: "Seu espaço profissional",
    title: "Sua prática, em um só lugar.",
    description: "Organize pacientes, materiais e atendimentos em uma rotina feita para a fonoaudiologia online.",
    image: "/landing/sessao-ao-vivo-demo.png",
    alt: "Demonstração de atendimento ao vivo na plataforma",
    icon: Video,
    benefits: ["Atendimento ao vivo com interação na tela", "Biblioteca de jogos e atividades", "Agenda e documentação conectadas"],
  },
  pacientes: {
    label: "Pacientes",
    title: "Cada paciente, com seu percurso à vista.",
    description: "Vincule seus pacientes e encontre perfis, histórico e documentação no contexto certo para cada atendimento.",
    image: "/landing/cadastro-teleatendimento.png",
    alt: "Paciente em atendimento online",
    icon: Users,
    benefits: ["Perfis profissionais e pacientes vinculados", "Acesso rápido ao histórico clínico", "Materiais enviados para cada paciente"],
  },
  atividades: {
    label: "Atividades",
    title: "Materiais que entram em cena na sessão.",
    description: "Crie sequências visuais do seu jeito, guarde na sua biblioteca e compartilhe com quem você atende.",
    image: "/landing/atividade-em-uso-demo-hd.png",
    alt: "Atividade interativa com imagens e palavras",
    icon: Activity,
    benefits: ["Criação de atividades personalizadas", "Biblioteca própria e conteúdos compartilhados", "Uso interativo durante a sessão"],
  },
  jogos: {
    label: "Jogos",
    title: "Aprender também pode ser brincar.",
    description: "Traga jogos terapêuticos para o atendimento e adapte desafios aos objetivos de cada paciente.",
    image: "/landing/roleta-dos-sons-demo-hd.png",
    alt: "Jogo terapêutico da roleta dos sons",
    icon: Gamepad2,
    benefits: ["Jogos de memória, sons e palavras", "Desafios criados para sua prática", "Interação em tempo real com o paciente"],
  },
  horarios: {
    label: "Horários",
    title: "Uma agenda que acompanha seu trabalho.",
    description: "Visualize sessões agendadas, entre no atendimento e mantenha o dia organizado sem perder o contexto do paciente.",
    image: "/landing/teleatendimento-fono.png",
    alt: "Profissional realizando teleatendimento",
    icon: CalendarDays,
    benefits: ["Sessões organizadas por paciente", "Acesso direto à sala ao vivo", "Visão clara da rotina de atendimentos"],
  },
  historico: {
    label: "Histórico",
    title: "O caminho percorrido fica registrado.",
    description: "Acompanhe os atendimentos anteriores e retome o trabalho de onde cada paciente parou.",
    image: "/landing/sessao-atividade-demo.png",
    alt: "Atividade realizada em sessão",
    icon: History,
    benefits: ["Registro das sessões realizadas", "Consulta por paciente", "Continuidade entre atendimentos"],
  },
  financeiro: {
    label: "Financeiro",
    title: "Sua rotina financeira, com mais clareza.",
    description: "Organize receitas, despesas e metas do seu trabalho e acompanhe os resultados da sua prática em um espaço próprio.",
    image: "",
    alt: "Prévia ilustrativa da organização financeira profissional",
    icon: Wallet,
    benefits: ["Receitas e despesas organizadas", "Acompanhamento dos resultados do mês", "Planejamento financeiro da sua prática"],
  },
  relatorios: {
    label: "Relatórios",
    title: "Documentação clínica sem se perder no caminho.",
    description: "Reúna avaliações, evoluções e relatórios por paciente, com espaço para registrar cada etapa do cuidado.",
    image: "",
    alt: "Prévia ilustrativa de documentação clínica",
    icon: FileText,
    benefits: ["Avaliações e evoluções organizadas", "Relatórios por paciente e tipo", "Rascunhos para continuar depois"],
  },
} as const;

const gamePreviews: Record<string, { label: string; title: string; description: string }> = {
  "complete-frase": { label: "Complete a frase", title: "Uma figura, uma palavra, novas frases.", description: "Escreva frases com lacunas, escolha as figuras e trabalhe a construção de frases com o paciente, uma palavra por vez." },
  historias: { label: "Histórias completas", title: "Construa um percurso completo para cada sessão.", description: "Reúna slides, vídeos e jogos em uma sequência e conduza o atendimento no ritmo de cada paciente." },
  "sons-imagens": { label: "Sons e imagens", title: "Conecte o que se vê ao que se escuta.", description: "Crie propostas com sons e figuras e adapte as associações aos objetivos do seu atendimento." },
  "sequencia-imagens": { label: "Sequência de imagens", title: "Cada imagem ajuda a construir uma história.", description: "Organize cenas em sequência e trabalhe a compreensão, a narrativa e a organização temporal com o paciente." },
  memoria: { label: "Memória", title: "Transforme seus objetivos em pares para descobrir.", description: "Crie jogos da memória com suas próprias imagens e explore cada descoberta junto com o paciente durante a sessão." },
  memoria2: { label: "Memória 2.0", title: "Pares personalizados para novas conexões.", description: "Escolha duas imagens para cada par e crie associações que façam sentido para o objetivo do atendimento." },
  fonema: { label: "Discriminação de fonemas", title: "Explore os sons da fala de forma interativa.", description: "Prepare desafios com fonemas e imagens para trabalhar a diferenciação dos sons da fala durante o atendimento." },
  auditivo: { label: "Estimulação auditiva", title: "Dê espaço para escutar, reconhecer e participar.", description: "Personalize desafios auditivos com sons e imagens e acompanhe a participação do paciente em tempo real." },
  forca: { label: "Forca", title: "Uma letra de cada vez, novas descobertas.", description: "Crie desafios de palavras com os temas e imagens que você escolher e use o jogo para estimular a participação." },
  roleta: { label: "Roleta musical", title: "Um giro pode mudar o ritmo da sessão.", description: "Monte sua roleta com propostas personalizadas e transforme cada rodada em uma oportunidade de interação." },
  "caca-palavras": { label: "Caça-palavras", title: "Palavras que convidam o paciente a explorar.", description: "Escolha as palavras e imagens para montar desafios alinhados ao seu planejamento terapêutico." },
  cartas: { label: "Jogo das cartas", title: "Cada carta abre uma nova possibilidade.", description: "Crie baralhos com imagens e propostas próprias e apresente os desafios conforme a dinâmica do atendimento." },
  "acerte-imagem": { label: "Acerte a imagem", title: "Revele pistas e convide o paciente a descobrir.", description: "Prepare imagens que aparecem aos poucos e conduza a descoberta no ritmo que fizer sentido para a sessão." },
  "boca-3d": { label: "Boca 3D", title: "Mostre movimentos articulatórios em outra dimensão.", description: "Use uma visualização tridimensional da boca para demonstrar movimentos e apoiar suas explicações durante o atendimento." },
};

function sectionForPath(pathname: string): keyof typeof previews {
  const section = pathname.split("/")[2];
  return section && section in previews ? section as keyof typeof previews : "dashboard";
}

type Props = { expiresOn?: string | null; onRefresh: () => Promise<boolean> };

export default function ProfessionalSubscriptionPreview({ expiresOn, onRefresh }: Props) {
  const { pathname, search } = useLocation();
  const section = sectionForPath(pathname);
  const game = section === "jogos" ? gamePreviews[pathname.split("/")[3]] : undefined;
  const activityView = section === "atividades" ? new URLSearchParams(search).get("visao") : null;
  const gameImages: Record<string, string> = { historias: "/landing/atividade-em-uso-demo-hd.png", "sequencia-imagens": "/landing/sequencia-jardim.png", memoria: "/landing/criacao-memoria-demo.png", memoria2: "/landing/criacao-memoria-demo.png", roleta: "/landing/roleta-dos-sons-demo-hd.png", "boca-3d": "/landing/boca-3d-profissional.png" };
  const preview = { ...previews[section], ...game, ...(game ? { image: gameImages[pathname.split("/")[3]] ?? "", alt: `Apresentação de ${game.label}` } : {}),
    ...(activityView === "biblioteca" ? { label: "Biblioteca de atividades", title: "Seus materiais, prontos para a próxima sessão." } : activityView === "pacientes" ? { label: "Atividades por paciente", title: "A proposta certa para cada paciente." } : {}) };
  const Icon = preview.icon;
  const expired = !!expiresOn;
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const verify = async () => {
    if (checking) return;
    setChecking(true);
    setFeedback("");
    try {
      if (!await onRefresh()) setFeedback("Sua assinatura ainda não está ativa. Se você já pagou, aguarde a confirmação e verifique novamente.");
    } catch {
      setFeedback("Não foi possível verificar agora. Tente novamente em instantes.");
    } finally { setChecking(false); }
  };

  return (
    <div data-subscription-preview className="min-h-[calc(100vh-4rem)] bg-[#f2f8f5] text-[#24352c]">
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cbded2] pb-5">
          <div className="flex items-center gap-3 text-sm font-medium text-[#166534]">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ddf3e5]"><Icon size={19} aria-hidden="true" /></span>
            <span>{preview.label}</span>
          </div>
          <span className="rounded-full border border-[#c4dfce] bg-white px-3 py-1 text-xs font-semibold text-[#43624e]">
            {expired ? "Assinatura inativa" : "Explore sua plataforma"}
          </span>
        </div>

        <section className="grid items-center gap-9 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-16">
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e2f3e8] px-3 py-1.5 text-xs font-bold text-[#087a3c]"><LockKeyhole size={13} aria-hidden="true" />Conheça este recurso</p>
            <h1 className="max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{preview.title}</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#52655a]">{preview.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/profissional/assinatura" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#087a42] px-5 font-semibold text-white transition-colors hover:bg-[#066534]">Escolher meu plano <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
            <button type="button" onClick={() => void verify()} disabled={checking} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#35664a] underline-offset-4 hover:underline disabled:opacity-60">
              <RefreshCw size={15} className={checking ? "animate-spin" : ""} aria-hidden="true" /> {checking ? "Verificando..." : "Já paguei, verificar acesso"}
            </button>
            {feedback && <p role="status" className="mt-3 max-w-lg text-sm leading-relaxed text-[#52655a]">{feedback}</p>}
          </div>
          <div className="min-w-0 overflow-hidden rounded-md border border-[#c7ddd0] bg-white shadow-[0_24px_50px_-35px_rgba(26,74,45,0.45)]">
            {preview.image ? (
              <img src={preview.image} alt={preview.alt} className="aspect-[16/10] w-full object-contain" />
            ) : game ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-5 bg-gradient-to-br from-[#e8f6ed] via-white to-[#fff3dd] p-6 text-center sm:min-h-[340px] sm:p-8" role="img" aria-label={`Prévia ilustrativa de ${game.label}`}>
                <span className="rounded-full border border-[#d5e6da] bg-white px-3 py-1 text-xs text-[#596e60]">Prévia ilustrativa</span>
                <span className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[#c7ddd0] bg-white text-[#16864b] shadow-sm"><Gamepad2 size={48} strokeWidth={1.4} aria-hidden="true" /></span>
                <p className="max-w-sm font-display text-2xl font-bold text-[#17462b]">{game.label}</p>
                <p className="max-w-sm text-sm leading-relaxed text-[#52655a]">Seus materiais, seus objetivos e a participação do paciente na mesma atividade.</p>
              </div>
            ) : section === "financeiro" ? (
              <div className="min-h-[270px] bg-[#f8fbf9] p-5 sm:p-7" role="img" aria-label={preview.alt}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d5e6da] pb-4"><span className="flex items-center gap-2 text-sm font-semibold text-[#17462b]"><Wallet size={18} />Visão financeira</span><span className="text-xs text-[#7b9482]">Prévia ilustrativa</span></div>
                <div className="my-5 grid grid-cols-2 gap-3">{["Receitas do mês", "Despesas do mês"].map((label) => <div key={label} className="rounded-lg border border-[#d5e6da] bg-white p-4"><p className="text-xs text-[#596e60]">{label}</p><p className="mt-3 text-xl font-semibold text-[#17462b]">R$ —</p></div>)}</div>
                <div className="flex h-28 items-end justify-around gap-3 rounded-lg border border-[#d5e6da] bg-white px-4 pb-4 pt-5" aria-hidden="true">{["h-2/5", "h-3/5", "h-1/2", "h-4/5", "h-full", "h-3/4"].map((height, index) => <span key={index} className={`w-7 rounded-t bg-[#a9dabb] ${height}`} />)}</div>
              </div>
            ) : (
              <div className="flex aspect-[16/10] min-h-[270px] flex-col bg-[#f8fbf9] p-5 sm:p-7" role="img" aria-label={preview.alt}>
                <div className="flex items-center justify-between border-b border-[#d5e6da] pb-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#17462b]"><FileText size={18} /> Documentação clínica</span>
                  <span className="text-xs text-[#7b9482]">Prévia ilustrativa</span>
                </div>
                <div className="grid flex-1 grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] gap-3 py-4 sm:gap-5">
                  <div className="space-y-2 border-r border-[#d5e6da] pr-3 sm:pr-5">
                    <span className="block rounded bg-[#e0f2e7] px-3 py-2 text-xs font-semibold text-[#126337]">Avaliações</span>
                    <span className="block px-3 py-2 text-xs text-[#596e60]">Evoluções</span>
                    <span className="block px-3 py-2 text-xs text-[#596e60]">Relatórios</span>
                  </div>
                  <div className="min-w-0 rounded border border-[#d5e6da] bg-white p-4 shadow-sm sm:p-5">
                    <span className="text-[11px] font-semibold uppercase text-[#268151]">Avaliação fonoaudiológica</span>
                    <div className="mt-3 h-2 w-4/5 rounded bg-[#dae7dd]" />
                    <div className="mt-2 h-2 w-full rounded bg-[#e9f0eb]" />
                    <div className="mt-2 h-2 w-11/12 rounded bg-[#e9f0eb]" />
                    <div className="mt-5 h-2 w-2/3 rounded bg-[#dae7dd]" />
                    <div className="mt-2 h-2 w-full rounded bg-[#e9f0eb]" />
                    <div className="mt-2 h-2 w-3/4 rounded bg-[#e9f0eb]" />
                    <div className="mt-5 inline-flex items-center gap-1 rounded bg-[#e0f2e7] px-2 py-1 text-[11px] font-medium text-[#126337]"><Check size={12} /> Organizado por paciente</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-5 border-t border-[#cbded2] pt-7 sm:grid-cols-3">
          {preview.benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-3 text-sm font-medium leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d9f2e2] text-[#087a42]"><Check size={13} aria-hidden="true" /></span>
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[#cbded2] pt-6 text-sm text-[#52655a]">
          <p>Ative sua assinatura para usar este recurso e todas as áreas da plataforma.</p>
          <Link to="/profissional/assinatura" className="inline-flex items-center gap-2 font-semibold text-[#087a42] hover:underline">Ver mensal, trimestral e anual <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
