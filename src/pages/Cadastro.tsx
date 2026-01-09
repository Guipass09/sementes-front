import LoginHero from "@/components/LoginHero";
import RegisterForm from "@/components/RegisterForm";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";

const Cadastro = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-brand-mint/5 to-brand-yellow/5">
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Hero Section - Left on Desktop */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-brand-mint/20 via-background to-brand-green/5">
          <LoginHero />
        </div>

        {/* Form Section - Right on Desktop, Full on Mobile */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo - centralizado */}
            <div className="lg:hidden mb-6 flex flex-col items-center justify-center">
              <div className="relative mb-4 animate-float">
                <div className="absolute inset-0 bg-brand-green/20 rounded-2xl blur-xl scale-110" />
                <img
                  src={logoImage}
                  alt="Sementes da Fala - Logo"
                  className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain rounded-2xl shadow-lg"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
                <span className="text-brand-green">Sementes</span>{" "}
                <span className="text-brand-brown">da Fala</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Cultivando a comunicação, plantando o futuro
              </p>
              {/* Decorative line */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-8 h-1 bg-brand-green rounded-full" />
                <div className="w-2 h-2 bg-brand-orange rounded-full" />
                <div className="w-6 h-1 bg-brand-yellow rounded-full" />
                <div className="w-2 h-2 bg-brand-blue rounded-full" />
                <div className="w-8 h-1 bg-brand-purple rounded-full" />
              </div>
            </div>

            {/* Login Card */}
            <div className="login-card animate-slide-in-right">
              {/* Header */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Criar Conta
                </h2>
                <p className="text-muted-foreground">
                  Preencha os dados para criar sua conta
                </p>
              </div>

              {/* Form */}
              <RegisterForm />
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              © 2024 Sementes da Fala. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;
