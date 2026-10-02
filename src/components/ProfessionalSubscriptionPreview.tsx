import { Activity, ArrowRight, CalendarDays, Check, FileText, Gamepad2, History, MessageCircle, RefreshCw, Users, Video } from "lucide-react";
import { useLocation } from "react-router-dom";

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

function sectionForPath(pathname: string): keyof typeof previews {
  const section = pathname.split("/")[2];
  return section && section in previews ? section as keyof typeof previews : "dashboard";
}

type Props = { expiresOn?: string | null; onRefresh: () => void };

export default function ProfessionalSubscriptionPreview({ expiresOn, onRefresh }: Props) {
  const { pathname } = useLocation();
  const preview = previews[sectionForPath(pathname)];
  const Icon = preview.icon;
  const expired = !!expiresOn;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f2f8f5] text-[#24352c]">
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#cbded2] pb-5">
          <div className="flex items-center gap-3 text-sm font-medium text-[#166534]">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ddf3e5]"><Icon size={19} aria-hidden="true" /></span>
            <span>{preview.label}</span>
          </div>
          <span className="rounded-full border border-[#c4dfce] bg-white px-3 py-1 text-xs font-semibold text-[#43624e]">
            {expired ? "Assinatura encerrada" : "Conta pronta para ativação"}
          </span>
        </div>

        <section className="grid items-center gap-9 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:py-16">
          <div className="min-w-0">
            <p className="mb-4 text-xs font-bold uppercase text-[#087a3c]">Conheça o que está à sua disposição</p>
            <h1 className="max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">{preview.title}</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#52655a]">{preview.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="https://wa.me/message/GKL4EEB2NSI4A1" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#087a42] px-5 font-semibold text-white transition-colors hover:bg-[#066534]">
                <MessageCircle size={17} aria-hidden="true" /> Solicitar ativação
              </a>
              <a href="/#planos" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#7fb997] bg-white px-5 font-semibold text-[#075f35] transition-colors hover:bg-[#e9f6ee]">
                Conhecer os planos <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <button type="button" onClick={onRefresh} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#35664a] underline-offset-4 hover:underline">
              <RefreshCw size={15} aria-hidden="true" /> Já ativei meu acesso
            </button>
          </div>
          <div className="min-w-0 overflow-hidden rounded-md border border-[#c7ddd0] bg-white shadow-[0_24px_50px_-35px_rgba(26,74,45,0.45)]">
            {preview.image ? (
              <img src={preview.image} alt={preview.alt} className="aspect-[16/10] w-full object-contain" />
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
          <p>Uma assinatura libera todas as áreas da plataforma.</p>
          <a href="/#planos" className="inline-flex items-center gap-2 font-semibold text-[#087a42] hover:underline">Ver mensal, trimestral e anual <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
      </div>
    </div>
  );
}
