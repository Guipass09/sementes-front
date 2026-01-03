import { Link } from "react-router-dom";
import { Activity, Calendar, FileText, ArrowRight, Heart, Star } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";

const shortcuts = [
  {
    path: "/paciente/atividades",
    icon: Activity,
    title: "Atividades",
    description: "Acesse as atividades terapêuticas disponíveis para realizar em casa",
    color: "from-brand-green to-brand-green-dark",
  },
  {
    path: "/paciente/sessoes",
    icon: Calendar,
    title: "Sessões",
    description: "Visualize suas sessões agendadas e histórico de atendimentos",
    color: "from-brand-orange to-brand-orange-dark",
  },
  {
    path: "/paciente/relatorios",
    icon: FileText,
    title: "Relatórios",
    description: "Acompanhe a evolução e os relatórios do desenvolvimento",
    color: "from-brand-blue to-brand-purple",
  },
];

const PatientHome = () => {
  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-brand-mint via-background to-brand-green/5 py-16 lg:py-24 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-brand-orange/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-block mb-6 animate-float">
              <div className="relative">
                <div className="absolute inset-0 bg-brand-green/20 rounded-2xl blur-xl scale-110" />
                <img
                  src={logoImage}
                  alt="Sementes da Fala"
                  className="relative w-24 h-24 lg:w-32 lg:h-32 object-contain rounded-2xl shadow-lg mx-auto"
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-bold text-foreground mb-4 animate-fade-in">
              Bem-vindo ao{" "}
              <span className="text-brand-green">Ambiente</span>{" "}
              <span className="text-brand-brown">do Paciente</span>
            </h1>

            {/* Description */}
            <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Esta é a sua plataforma exclusiva para acompanhamento terapêutico. 
              Aqui você encontra atividades, sessões e relatórios do desenvolvimento do seu filho.
            </p>

            {/* Features badges */}
            <div className="flex flex-wrap justify-center gap-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-green/10 text-brand-green text-sm font-medium">
                <Heart size={16} />
                Acompanhamento personalizado
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-orange/10 text-brand-orange text-sm font-medium">
                <Star size={16} />
                Atividades exclusivas
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Shortcuts Section */}
      <section className="py-12 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-3">
              Acesso Rápido
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Navegue facilmente entre as principais áreas da plataforma
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {shortcuts.map((shortcut, index) => {
              const Icon = shortcut.icon;
              return (
                <Link
                  key={shortcut.path}
                  to={shortcut.path}
                  className="group relative bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${shortcut.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={28} className="text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-display font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                    {shortcut.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {shortcut.description}
                  </p>

                  {/* Arrow */}
                  <div className="flex items-center text-primary font-medium text-sm">
                    <span>Acessar</span>
                    <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 lg:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl lg:text-2xl font-display font-bold text-foreground mb-4">
              Cultivando a comunicação, plantando o futuro
            </h2>
            <p className="text-muted-foreground">
              A Sementes da Fala está comprometida com o desenvolvimento da comunicação do seu filho. 
              Utilize esta plataforma para acompanhar cada passo dessa jornada especial.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PatientHome;
