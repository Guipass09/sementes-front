import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Check, Mail } from "lucide-react";
import LoginHero from "@/components/LoginHero";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useToast } from "@/hooks/use-toast";
import { forgotPassword, isApiError } from "@/lib/laravel-api";

const EsqueciSenha = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const validateEmail = useCallback((v: string): { valid: boolean; message: string } => {
    if (!v.trim()) return { valid: false, message: "Email é obrigatório" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(v)) return { valid: false, message: "Digite um email válido" };
    return { valid: true, message: "" };
  }, []);

  const { valid, message } = validateEmail(email);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");

    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await forgotPassword(email.trim());
      toast({ title: "Pronto!", description: res.message });
      navigate(`/redefinir-senha?email=${encodeURIComponent(email.trim())}`);
    } catch (e2) {
      const msg =
        isApiError(e2) && e2.status === 422
          ? (e2.data?.message ?? "Verifique o email e tente novamente.")
          : "Não foi possível enviar o token agora. Tente novamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const Card = (
    <div className="login-card animate-slide-in-right">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Esqueci minha senha</h2>
        <p className="text-muted-foreground">Informe seu email para receber um token</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in mb-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-semibold text-foreground">
            Email
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Mail size={18} />
            </div>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="seu@email.com"
              autoComplete="email"
              className={`input-field pl-11 pr-10 ${touched ? (valid ? "success" : "error") : ""}`}
              aria-invalid={touched && !valid}
            />
            {touched && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {touched && !valid && <p className="text-sm text-destructive animate-fade-in">{message}</p>}
        </div>

        <button type="submit" disabled={submitting} className={`btn-primary ${submitting ? "opacity-80" : ""}`}>
          {submitting ? "Enviando..." : "Enviar token"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link to="/entrar" className="font-semibold text-primary hover:text-brand-green-dark transition-colors">
            Voltar ao login
          </Link>
        </p>
      </form>
    </div>
  );

  return (
    <main className="min-h-screen gradient-hero">
      {/* Desktop */}
      <div className="hidden lg:flex min-h-screen">
        <section className="w-1/2 xl:w-[55%] relative flex items-center justify-center bg-gradient-to-br from-brand-mint via-background to-brand-green/5">
          <LoginHero />
        </section>
        <section className="w-1/2 xl:w-[45%] flex items-center justify-center p-8 xl:p-16">
          <div className="w-full max-w-md">
            {Card}
            <footer className="mt-6 text-center text-sm text-muted-foreground">
              <p>© {new Date().getFullYear()} Sementes da Fala. Todos os direitos reservados.</p>
            </footer>
          </div>
        </section>
      </div>

      {/* Mobile */}
      <div className="lg:hidden min-h-screen flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-brand-orange/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-sm animate-fade-in">
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

          {Card}

          <footer className="mt-6 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Sementes da Fala</p>
          </footer>
        </div>
      </div>
    </main>
  );
};

export default EsqueciSenha;


