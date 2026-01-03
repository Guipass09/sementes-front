import { Link } from "react-router-dom";
import {
  CalendarDays,
  ClipboardCheck,
  Gamepad2,
  Users,
  TrendingUp,
  BookOpen,
  BarChart3,
  Video,
  MessageCircle,
  Volume2,
  UserCheck,
  Wifi,
  Instagram,
  Mail,
} from "lucide-react";
import type React from "react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LandingFeature = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  iconBgClassName: string;
  cardClassName: string;
};

function InfoCard({
  feature,
  subtitle,
  showCta = true,
  badge,
}: {
  feature: LandingFeature;
  subtitle?: string;
  showCta?: boolean;
  badge?: React.ReactNode;
}) {
  const Icon = feature.icon;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={[
            "group w-full text-left rounded-3xl border border-border/70 bg-white/55 backdrop-blur-sm",
            "shadow-[0_12px_40px_-18px_hsl(142_30%_30%_/_0.25)]",
            "transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/75",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "min-h-[180px]",
            feature.cardClassName,
          ].join(" ")}
          aria-label={`Saiba mais: ${feature.title}`}
        >
          <div className="p-8">
            {badge ? <div className="mb-3">{badge}</div> : null}
            <div className={`w-16 h-16 rounded-2xl grid place-items-center ${feature.iconBgClassName}`}>
              <Icon size={28} className="text-white" />
            </div>
            <h3 className="mt-5 text-xl font-display font-bold text-foreground">{feature.title}</h3>
            {subtitle ? (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
            ) : null}
            {showCta ? (
              <span className="mt-4 inline-flex text-sm font-semibold text-brand-orange group-hover:text-brand-orange-dark transition-colors">
                Saiba mais →
              </span>
            ) : null}
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl rounded-2xl bg-background/95 backdrop-blur border-border">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-4 pr-8">
            <div className={`w-14 h-14 rounded-2xl grid place-items-center ${feature.iconBgClassName}`}>
              <Icon size={26} className="text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-display">{feature.title}</DialogTitle>
              <DialogDescription className="mt-3 text-base leading-relaxed text-muted-foreground">
                {feature.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export default function Landing() {
  const whatsappCtaHref = "https://wa.me/message/GKL4EEB2NSI4A1";
  const instagramHref = "https://www.instagram.com/sementes_dafalaoficial/";
  const contactEmail = "sementesdafala@gmail.com";

  const termsLastUpdated = "***/***/____";
  const privacyLastUpdated = "***/***/____";

  const howItWorks: LandingFeature[] = [
    {
      key: "avaliacao",
      title: "Avaliação Personalizada",
      description:
        "Identificamos as necessidades específicas de cada criança para criar um plano individualizado. Tudo é pensado para apoiar o desenvolvimento de forma acolhedora e efetiva.",
      icon: ClipboardCheck,
      iconBgClassName: "bg-brand-purple",
      cardClassName: "bg-brand-mint/35",
    },
    {
      key: "atividades",
      title: "Atividades Interativas",
      description:
        "Jogos educativos e atividades práticas desenvolvidas por especialistas para estimular fala, linguagem e cognição de um jeito leve e divertido.",
      icon: Gamepad2,
      iconBgClassName: "bg-brand-blue",
      cardClassName: "bg-brand-mint/35",
    },
    {
      key: "acompanhamento",
      title: "Acompanhamento Profissional",
      description:
        "Fonoaudiólogos especializados acompanham de perto cada etapa. Você recebe orientações claras e consistentes para evoluir com segurança.",
      icon: Users,
      iconBgClassName: "bg-brand-green",
      cardClassName: "bg-brand-mint/35",
    },
    {
      key: "evolucao",
      title: "Evolução Registrada",
      description:
        "Acompanhe o progresso com relatórios e indicadores claros. Assim, fica fácil entender conquistas, desafios e próximos passos.",
      icon: TrendingUp,
      iconBgClassName: "bg-brand-orange",
      cardClassName: "bg-brand-mint/35",
    },
  ];

  const platformFeatures: LandingFeature[] = [
    {
      key: "atividades-personalizadas",
      title: "Atividades Personalizadas",
      description:
        "Cada criança recebe um programa de atividades desenvolvido especialmente para suas necessidades. Os exercícios são ajustados automaticamente conforme o progresso, garantindo sempre o nível ideal de desafio.",
      icon: BookOpen,
      iconBgClassName: "bg-brand-purple",
      cardClassName: "bg-[#eef0f3]",
    },
    {
      key: "jogos-educativos",
      title: "Jogos Educativos",
      description:
        "Nossa biblioteca de jogos foi desenvolvida por fonoaudiólogos e game designers para tornar o aprendizado divertido. Cada jogo trabalha aspectos específicos da comunicação enquanto a criança se diverte.",
      icon: Gamepad2,
      iconBgClassName: "bg-gradient-to-br from-brand-green to-brand-blue",
      cardClassName: "bg-[#e9f6fb]",
    },
    {
      key: "acompanhamento-evolucao",
      title: "Acompanhamento de Evolução",
      description:
        "Acompanhe cada conquista através de relatórios detalhados e gráficos de evolução. Visualize o progresso semanal e mensal, e celebre cada marco alcançado.",
      icon: BarChart3,
      iconBgClassName: "bg-gradient-to-br from-brand-green to-brand-yellow",
      cardClassName: "bg-[#e9f5ea]",
    },
    {
      key: "atendimento-profissional",
      title: "Atendimento Profissional",
      description:
        "Sessões individuais com fonoaudiólogos experientes, realizadas no conforto da sua casa. Nossa equipe utiliza técnicas baseadas em evidências para garantir os melhores resultados.",
      icon: Video,
      iconBgClassName: "bg-brand-orange",
      cardClassName: "bg-[#f7efe2]",
    },
  ];

  return (
    <main className="min-h-screen gradient-hero">
      {/* Background decorative blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-brand-yellow/15 rounded-full blur-3xl" />
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] bg-brand-purple/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[560px] h-[560px] bg-brand-green/12 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[520px] h-[520px] bg-brand-blue/10 rounded-full blur-3xl" />
      </div>

      {/* Top nav */}
      <header className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoImage}
              alt="Sementes da Fala"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-contain bg-white/60"
            />
            <span className="hidden sm:block font-display font-bold text-lg leading-none">
              <span className="text-brand-green">Sementes</span>{" "}
              <span className="text-brand-brown">da Fala</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              to="/entrar"
              className="px-4 py-2 text-sm font-semibold text-foreground/80 hover:text-foreground transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/cadastro"
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-dark transition-colors shadow-sm"
            >
              Cadastrar-se
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-16 sm:pt-12 sm:pb-24">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8 sm:mb-10">
              <div className="absolute inset-0 bg-brand-green/15 rounded-3xl blur-2xl scale-110" />
              <div className="relative bg-white/60 backdrop-blur rounded-2xl p-6 sm:p-8 shadow-[0_22px_70px_-40px_rgba(0,0,0,0.35)]">
                <img
                  src={logoImage}
                  alt="Sementes da Fala"
                  className="w-44 h-44 sm:w-56 sm:h-56 object-contain rounded-xl"
                />
              </div>
            </div>

            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-foreground max-w-4xl">
              Desenvolvendo a comunicação do seu filho com{" "}
              <span className="text-brand-orange">cuidado</span>,{" "}
              <span className="text-brand-green">afeto</span> e{" "}
              <span className="text-brand-blue">tecnologia</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Uma plataforma completa de atividades, jogos e acompanhamento fonoaudiológico online.
            </p>

            <div className="mt-10">
              <a
                href={whatsappCtaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full px-8 py-4 text-base font-bold text-white bg-brand-orange hover:bg-brand-orange-dark transition-colors shadow-[0_16px_50px_-28px_rgba(0,0,0,0.45)]"
              >
                <CalendarDays size={20} />
                Agendar sessão experimental gratuita
              </a>
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="mr-1">✨</span> Sem compromisso • 100% online • Especialistas qualificados
              </p>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="w-full overflow-hidden leading-none">
          <svg
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            className="w-full h-16 sm:h-20 text-white"
          >
            <path
              fill="currentColor"
              d="M0,64L60,74.7C120,85,240,107,360,101.3C480,96,600,64,720,53.3C840,43,960,53,1080,64C1200,75,1320,85,1380,90.7L1440,96L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z"
            />
          </svg>
        </div>
      </section>

      {/* Como funciona */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground">Como Funciona</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Um processo simples e acolhedor para ajudar no desenvolvimento da comunicação do seu filho
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((f, idx) => (
              <InfoCard
                key={f.key}
                feature={f}
                showCta={false}
                badge={
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-green/20 text-brand-green font-bold">
                    {idx + 1}
                  </span>
                }
                subtitle={
                  f.key === "avaliacao"
                    ? "Identificamos as necessidades específicas de cada criança para criar um plano de desenvolvimento único."
                    : f.key === "atividades"
                      ? "Jogos educativos desenvolvidos por especialistas para estimular a fala de forma divertida."
                      : f.key === "acompanhamento"
                        ? "Fonoaudiólogos especializados acompanham cada etapa do desenvolvimento."
                        : "Acompanhe o progresso do seu filho com relatórios claros e acessíveis."
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground">
              Funcionalidades da Plataforma
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para apoiar o desenvolvimento do seu filho
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-7">
            {platformFeatures.map((f) => (
              <InfoCard
                key={f.key}
                feature={f}
                subtitle={
                  f.key === "atividades-personalizadas"
                    ? "Exercícios adaptados à dificuldade da criança"
                    : f.key === "jogos-educativos"
                      ? "Jogos interativos para estimular fala, linguagem e cognição"
                      : f.key === "acompanhamento-evolucao"
                        ? "Histórico, progresso e relatórios claros"
                        : "Sessões online com fonoaudióloga especializada"
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* Para quem é */}
      <section className="bg-brand-mint">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-extrabold text-foreground">Para Quem É</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              A Sementes da Fala foi criada pensando em famílias como a sua
            </p>
          </div>

          {(() => {
            const items: Array<{
              title: string;
              subtitle: string;
              icon: React.ComponentType<{ size?: number | string; className?: string }>;
              iconWrapClassName: string;
              iconClassName: string;
            }> = [
              {
                title: "Crianças com atraso na fala",
                subtitle: "Apoio especializado para desenvolver a comunicação",
                icon: MessageCircle,
                iconWrapClassName: "bg-brand-purple/15",
                iconClassName: "text-brand-purple",
              },
              {
                title: "Dificuldades de pronúncia",
                subtitle: "Exercícios para melhorar a articulação das palavras",
                icon: Volume2,
                iconWrapClassName: "bg-brand-blue/12",
                iconClassName: "text-brand-blue",
              },
              {
                title: "Acompanhamento profissional",
                subtitle: "Para pais que buscam orientação especializada",
                icon: UserCheck,
                iconWrapClassName: "bg-brand-green/12",
                iconClassName: "text-brand-green",
              },
              {
                title: "Praticidade online",
                subtitle: "Para famílias que valorizam flexibilidade",
                icon: Wifi,
                iconWrapClassName: "bg-brand-orange/12",
                iconClassName: "text-brand-orange",
              },
            ];
            return (
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <div
                      key={it.title}
                      className="rounded-3xl bg-white/80 backdrop-blur border border-border shadow-[0_14px_48px_-28px_rgba(0,0,0,0.25)] p-8 text-center"
                    >
                      <div className={`mx-auto w-16 h-16 rounded-2xl grid place-items-center ${it.iconWrapClassName}`}>
                        <Icon size={26} className={it.iconClassName} />
                      </div>
                      <h3 className="mt-5 text-lg font-display font-bold text-foreground">{it.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.subtitle}</p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </section>

      {/* CTA final (bloco laranja acima do rodapé) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-orange via-brand-orange to-brand-yellow">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 right-12 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 text-center text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
            <span aria-hidden>✨</span>
            Sessão experimental gratuita
          </div>

          <h2 className="mt-7 font-display font-extrabold tracking-tight text-4xl sm:text-5xl lg:text-6xl">
            Comece agora a jornada de desenvolvimento do seu filho
          </h2>

          <p className="mt-5 text-base sm:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed">
            Agende uma sessão experimental gratuita e descubra como podemos ajudar no desenvolvimento da comunicação da
            sua criança.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4">
            <a
              href={whatsappCtaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-4 text-base font-extrabold text-brand-orange shadow-[0_18px_60px_-28px_rgba(0,0,0,0.45)] hover:bg-white/95 transition-colors"
            >
              <CalendarDays size={20} />
              Agendar Sessão Experimental Gratuita
            </a>
            <p className="text-sm text-white/85">
              ✓ Sem compromisso &nbsp;•&nbsp; ✓ 100% online &nbsp;•&nbsp; ✓ Atendimento humanizado
            </p>
          </div>
        </div>
      </section>

      {/* Rodapé (final da página) */}
      <footer className="bg-[#203642] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 items-start">
            {/* Coluna: Logo + descrição */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
                  <img src={logoImage} alt="Sementes da Fala" className="w-12 h-12 object-contain rounded-lg bg-white/80" />
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed max-w-sm">
                Desenvolvendo a comunicação infantil com cuidado, afeto e tecnologia. Uma plataforma completa de
                fonoaudiologia online.
              </p>
            </div>

            {/* Coluna: Links úteis */}
            <div className="text-center md:text-left">
              <h3 className="text-lg font-display font-bold">Links Úteis</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm items-center md:items-start">
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-white/70 hover:text-white transition-colors text-left bg-transparent p-0 m-0 border-0 appearance-none"
                    >
                      Termos de Uso
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl rounded-2xl bg-background/95 backdrop-blur border-border max-h-[80vh] overflow-hidden">
                    <div className="max-h-[70vh] overflow-auto pr-2">
                      <DialogHeader className="text-left">
                        <DialogTitle className="text-2xl font-display">Termos de Uso</DialogTitle>
                        <DialogDescription>
                          Última atualização: <strong>{termsLastUpdated}</strong>
                        </DialogDescription>
                      </DialogHeader>

                      <div className="mt-5 space-y-5 text-sm sm:text-base leading-relaxed text-foreground">
                        <p>
                          Bem-vindo(a) à plataforma <strong>Sementes da Fala</strong>. Ao acessar ou utilizar nossos
                          serviços, você concorda com os presentes Termos de Uso. Caso não concorde com qualquer
                          condição aqui descrita, recomendamos que não utilize a plataforma.
                        </p>

                        <div>
                          <h4 className="font-display font-bold text-lg">1. OBJETIVO DA PLATAFORMA</h4>
                          <p className="mt-2">
                            A plataforma <strong>Sementes da Fala</strong> tem como objetivo oferecer conteúdos
                            educativos, atividades terapêuticas, materiais digitais e, quando contratado, atendimentos
                            online voltados ao desenvolvimento da fala, linguagem e aprendizagem.
                          </p>
                          <p className="mt-2">
                            Os conteúdos disponibilizados <strong>não substituem avaliação ou acompanhamento presencial</strong>{" "}
                            com profissional de saúde, quando necessário.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">2. CADASTRO E ACESSO</h4>
                          <p className="mt-2">
                            Para utilizar determinadas funcionalidades, o usuário poderá precisar criar uma conta,
                            fornecendo informações verdadeiras e atualizadas. O usuário é responsável por manter a
                            confidencialidade de seus dados de acesso.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">3. USO ADEQUADO DA PLATAFORMA</h4>
                          <p className="mt-2">Ao utilizar a plataforma, o usuário compromete-se a:</p>
                          <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Utilizar os conteúdos apenas para fins pessoais e educativos;</li>
                            <li>Não copiar, reproduzir, distribuir ou comercializar materiais sem autorização;</li>
                            <li>Não utilizar a plataforma para fins ilegais, ofensivos ou que violem direitos de terceiros.</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">4. PROPRIEDADE INTELECTUAL</h4>
                          <p className="mt-2">
                            Todo o conteúdo disponível (textos, vídeos, imagens, atividades, logotipo, marca, layout e
                            materiais pedagógicos) é protegido por direitos autorais e pertence à{" "}
                            <strong>Sementes da Fala</strong>, sendo proibida sua reprodução sem autorização prévia.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">5. ATENDIMENTOS ONLINE</h4>
                          <p className="mt-2">
                            Os atendimentos realizados têm caráter educativo e terapêutico, respeitando os limites
                            éticos da profissão. Eles <strong>não substituem avaliação médica ou psicológica presencial</strong>,
                            quando necessária.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">6. ALTERAÇÕES NOS TERMOS</h4>
                          <p className="mt-2">
                            A plataforma poderá atualizar estes Termos de Uso a qualquer momento. Recomenda-se a leitura
                            periódica para se manter informado.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">7. CONTATO</h4>
                          <p className="mt-2">
                            Em caso de dúvidas, entre em contato pelo e-mail: <strong>{contactEmail}</strong>
                          </p>
                        </div>

                        <p className="text-muted-foreground">
                          Ao utilizar a plataforma, você declara estar de acordo com estes Termos de Uso.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-white/70 hover:text-white transition-colors text-left bg-transparent p-0 m-0 border-0 appearance-none"
                    >
                      Política de Privacidade
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl rounded-2xl bg-background/95 backdrop-blur border-border max-h-[80vh] overflow-hidden">
                    <div className="max-h-[70vh] overflow-auto pr-2">
                      <DialogHeader className="text-left">
                        <DialogTitle className="text-2xl font-display">Política de Privacidade</DialogTitle>
                        <DialogDescription>
                          Última atualização: <strong>{privacyLastUpdated}</strong>
                        </DialogDescription>
                      </DialogHeader>

                      <div className="mt-5 space-y-5 text-sm sm:text-base leading-relaxed text-foreground">
                        <p>
                          A <strong>Sementes da Fala</strong> valoriza a sua privacidade e está comprometida com a proteção
                          dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº
                          13.709/2018 – LGPD).
                        </p>

                        <div>
                          <h4 className="font-display font-bold text-lg">1. DADOS COLETADOS</h4>
                          <p className="mt-2">Podemos coletar as seguintes informações:</p>
                          <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Nome, e-mail e dados de cadastro;</li>
                            <li>Informações fornecidas voluntariamente em formulários;</li>
                            <li>Dados de navegação (cookies, IP, tipo de dispositivo);</li>
                            <li>Informações necessárias para agendamento ou acesso a conteúdos.</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">2. FINALIDADE DO USO DOS DADOS</h4>
                          <p className="mt-2">Os dados coletados são utilizados para:</p>
                          <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Gerenciar o acesso à plataforma;</li>
                            <li>Oferecer conteúdos personalizados;</li>
                            <li>Realizar atendimentos online;</li>
                            <li>Enviar comunicações importantes e informativas;</li>
                            <li>Melhorar a experiência do usuário.</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">3. COMPARTILHAMENTO DE DADOS</h4>
                          <p className="mt-2">
                            Seus dados <strong>não são vendidos ou compartilhados com terceiros</strong>, exceto quando
                            necessário para:
                          </p>
                          <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Cumprimento de obrigações legais;</li>
                            <li>Processamento técnico da plataforma (hospedagem, pagamentos, segurança).</li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">4. ARMAZENAMENTO E SEGURANÇA</h4>
                          <p className="mt-2">
                            Utilizamos medidas técnicas e organizacionais para proteger seus dados contra acessos não
                            autorizados, vazamentos ou uso indevido.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">5. DIREITOS DO USUÁRIO</h4>
                          <p className="mt-2">Você pode, a qualquer momento:</p>
                          <ul className="mt-2 list-disc pl-6 space-y-1">
                            <li>Solicitar acesso aos seus dados;</li>
                            <li>Corrigir informações;</li>
                            <li>Solicitar exclusão de dados (quando permitido por lei);</li>
                            <li>Revogar consentimentos.</li>
                          </ul>
                          <p className="mt-2">
                            Para isso, entre em contato pelo e-mail: <strong>{contactEmail}</strong>
                          </p>
                        </div>

                        <div>
                          <h4 className="font-display font-bold text-lg">6. ALTERAÇÕES NA POLÍTICA</h4>
                          <p className="mt-2">
                            Esta Política de Privacidade pode ser atualizada a qualquer momento. Recomendamos a consulta
                            periódica.
                          </p>
                        </div>

                        <p className="text-muted-foreground">
                          Ao utilizar a plataforma, você concorda com esta Política de Privacidade.
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <a
                  href={whatsappCtaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white transition-colors text-left"
                >
                  Contato
                </a>
              </div>
            </div>

            {/* Coluna: Redes sociais */}
            <div className="md:text-right">
              <h3 className="text-lg font-display font-bold">Redes Sociais</h3>
              <div className="mt-4 flex items-center justify-center md:justify-end gap-3">
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-11 h-11 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15 transition-colors"
                >
                  <Instagram size={18} className="text-white" />
                </a>
                <a
                  href={whatsappCtaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="w-11 h-11 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15 transition-colors"
                >
                  <MessageCircle size={18} className="text-white" />
                </a>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      aria-label="Email"
                      className="w-11 h-11 rounded-full bg-white/10 border border-white/10 grid place-items-center hover:bg-white/15 transition-colors"
                    >
                      <Mail size={18} className="text-white" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg rounded-2xl bg-background/95 backdrop-blur border-border">
                    <DialogHeader className="text-left">
                      <DialogTitle className="text-2xl font-display">Contato por e-mail</DialogTitle>
                      <DialogDescription>Você pode falar com a equipe da Sementes da Fala por este e-mail:</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 font-semibold text-foreground">
                      {contactEmail}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8 text-center text-white/50 text-sm">
            © {new Date().getFullYear()} Sementes da Fala. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </main>
  );
}


