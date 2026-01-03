import logoImage from "@/assets/logo-sementes-da-fala.jpg";

const LoginHero = () => {
  return (
    <div className="relative flex flex-col items-center justify-center h-full p-8 lg:p-12">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Organic shapes */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-brand-green/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-brand-orange/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-brand-yellow/15 rounded-full blur-2xl" />
        <div className="absolute bottom-1/3 left-1/4 w-32 h-32 bg-brand-blue/10 rounded-full blur-2xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center animate-slide-in-left">
        {/* Logo */}
        <div className="relative mb-6 animate-float">
          <div className="absolute inset-0 bg-brand-green/20 rounded-full blur-2xl scale-110" />
          <img
            src={logoImage}
            alt="Sementes da Fala - Logo"
            className="relative w-64 h-64 lg:w-80 lg:h-80 object-contain rounded-3xl shadow-xl"
          />
        </div>

        {/* Company name */}
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground mb-3">
          <span className="text-brand-green">Sementes</span>{" "}
          <span className="text-brand-brown">da Fala</span>
        </h1>

        {/* Tagline */}
        <p className="text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Cultivando a comunicação, plantando o futuro
        </p>

        {/* Decorative line */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-12 h-1 bg-brand-green rounded-full" />
          <div className="w-3 h-3 bg-brand-orange rounded-full" />
          <div className="w-8 h-1 bg-brand-yellow rounded-full" />
          <div className="w-3 h-3 bg-brand-blue rounded-full" />
          <div className="w-12 h-1 bg-brand-purple rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default LoginHero;
