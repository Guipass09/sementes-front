import LoginForm from "@/components/LoginForm";
import LoginHero from "@/components/LoginHero";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";

const Index = () => {
  return (
    <main className="min-h-screen gradient-hero">
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-50 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-semibold shadow-lg">
          DEV • build: reports-modal-v1
        </div>
      )}
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left Column - Hero */}
        <section className="w-1/2 xl:w-[55%] relative flex items-center justify-center bg-gradient-to-br from-brand-mint via-background to-brand-green/5">
          <LoginHero />
        </section>

        {/* Right Column - Login Form */}
        <section className="w-1/2 xl:w-[45%] flex items-center justify-center p-8 xl:p-16">
          <div className="w-full max-w-md animate-slide-in-right">
            <div className="login-card">
              <header className="text-center mb-8">
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Bem-vindo de volta!
                </h2>
                <p className="text-muted-foreground">
                  Acesse sua conta para continuar
                </p>
              </header>

              <LoginForm />
            </div>

            {/* Footer */}
            <footer className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                © {new Date().getFullYear()} Sementes da Fala. Todos os direitos reservados.
              </p>
            </footer>
          </div>
        </section>
      </div>

      {/* Mobile & Tablet Layout */}
      <div className="lg:hidden min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
        {/* Background decorative elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-orange/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-sm animate-fade-in">
          {/* Logo */}
          <header className="text-center mb-8">
            <div className="relative inline-block mb-4 animate-float">
              <div className="absolute inset-0 bg-brand-green/20 rounded-2xl blur-xl scale-110" />
              <img
                src={logoImage}
                alt="Sementes da Fala - Logo"
                className="relative w-32 h-32 sm:w-40 sm:h-40 object-contain rounded-2xl shadow-lg mx-auto"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
              <span className="text-brand-green">Sementes</span>{" "}
              <span className="text-brand-brown">da Fala</span>
            </h1>
          </header>

          {/* Login Card */}
          <div className="login-card">
            <header className="text-center mb-6">
              <h2 className="text-xl font-display font-bold text-foreground mb-1">
                Bem-vindo de volta!
              </h2>
              <p className="text-sm text-muted-foreground">
                Acesse sua conta para continuar
              </p>
            </header>

            <LoginForm />
          </div>

          {/* Footer */}
          <footer className="mt-6 text-center text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} Sementes da Fala
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
};

export default Index;
