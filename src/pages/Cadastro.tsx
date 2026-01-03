import LoginHero from "@/components/LoginHero";
import RegisterForm from "@/components/RegisterForm";

const Cadastro = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-brand-mint/5 to-brand-yellow/5">
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Hero Section - Left on Desktop, Top on Mobile */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-gradient-to-br from-brand-mint/20 via-background to-brand-green/5">
          <LoginHero />
        </div>

        {/* Form Section - Right on Desktop, Full on Mobile */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <LoginHero />
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
