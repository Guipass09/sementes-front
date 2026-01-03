import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Check, Lock, Mail, KeyRound } from "lucide-react";
import LoginHero from "@/components/LoginHero";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { useToast } from "@/hooks/use-toast";
import { isApiError, resetPassword } from "@/lib/laravel-api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const RedefinirSenha = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState(query.get("email") ?? "");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; token: boolean; password: boolean; confirm: boolean }>({
    email: false,
    token: false,
    password: false,
    confirm: false,
  });
  const [error, setError] = useState("");

  const validateEmail = useCallback((v: string) => {
    if (!v.trim()) return { valid: false, message: "Email é obrigatório" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(v)) return { valid: false, message: "Digite um email válido" };
    return { valid: true, message: "" };
  }, []);

  const validateToken = useCallback((v: string) => {
    if (!v.trim()) return { valid: false, message: "Token é obrigatório" };
    if (v.trim().length < 10) return { valid: false, message: "Token inválido" };
    return { valid: true, message: "" };
  }, []);

  const validatePassword = useCallback((v: string) => {
    if (!v) return { valid: false, message: "Senha é obrigatória" };
    if (v.length < 8) return { valid: false, message: "Senha deve ter no mínimo 8 caracteres" };
    return { valid: true, message: "" };
  }, []);

  const validateConfirm = useCallback(
    (v: string, p: string) => {
      if (!v) return { valid: false, message: "Confirmação de senha é obrigatória" };
      if (v !== p) return { valid: false, message: "As senhas não coincidem" };
      return { valid: true, message: "" };
    },
    []
  );

  const vEmail = validateEmail(email);
  const vToken = validateToken(token);
  const vPass = validatePassword(password);
  const vConfirm = validateConfirm(confirmPassword, password);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTouched({ email: true, token: true, password: true, confirm: true });

    if (!vEmail.valid || !vToken.valid || !vPass.valid || !vConfirm.valid) return;

    setSubmitting(true);
    try {
      const res = await resetPassword({
        email: email.trim(),
        token: token.trim(),
        password,
        password_confirmation: confirmPassword,
      });
      toast({ title: "Senha redefinida", description: res.message });
      navigate("/entrar");
    } catch (e2) {
      const msg =
        isApiError(e2) && e2.status === 422
          ? (e2.data?.message ?? "Token/senha inválidos.")
          : "Não foi possível redefinir agora. Tente novamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const Card = (
    <div className="login-card animate-slide-in-right">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Redefinir senha</h2>
        <p className="text-muted-foreground">Digite o token recebido e escolha uma nova senha</p>
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
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
              placeholder="seu@email.com"
              autoComplete="email"
              className={`input-field pl-11 pr-10 ${touched.email ? (vEmail.valid ? "success" : "error") : ""}`}
              aria-invalid={touched.email && !vEmail.valid}
            />
            {touched.email && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {vEmail.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {touched.email && !vEmail.valid && <p className="text-sm text-destructive animate-fade-in">{vEmail.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="token" className="block text-sm font-semibold text-foreground">
            Token
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <KeyRound size={18} />
            </div>
            <input
              type="text"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, token: true }))}
              placeholder="Cole o token do email"
              autoComplete="one-time-code"
              className={`input-field pl-11 pr-10 ${touched.token ? (vToken.valid ? "success" : "error") : ""}`}
              aria-invalid={touched.token && !vToken.valid}
            />
            {touched.token && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {vToken.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {touched.token && !vToken.valid && <p className="text-sm text-destructive animate-fade-in">{vToken.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold text-foreground">
            Nova senha
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock size={18} />
            </div>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`input-field pl-11 pr-10 ${touched.password ? (vPass.valid ? "success" : "error") : ""}`}
              aria-invalid={touched.password && !vPass.valid}
            />
            {touched.password && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {vPass.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {touched.password && !vPass.valid && <p className="text-sm text-destructive animate-fade-in">{vPass.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm" className="block text-sm font-semibold text-foreground">
            Confirmar senha
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Lock size={18} />
            </div>
            <input
              type="password"
              id="confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
              placeholder="••••••••"
              autoComplete="new-password"
              className={`input-field pl-11 pr-10 ${touched.confirm ? (vConfirm.valid ? "success" : "error") : ""}`}
              aria-invalid={touched.confirm && !vConfirm.valid}
            />
            {touched.confirm && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {vConfirm.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {touched.confirm && !vConfirm.valid && <p className="text-sm text-destructive animate-fade-in">{vConfirm.message}</p>}
        </div>

        <button type="submit" disabled={submitting} className={`btn-primary ${submitting ? "opacity-80" : ""}`}>
          {submitting ? "Salvando..." : "Redefinir senha"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/esqueci-senha" className="font-semibold text-primary hover:text-brand-green-dark transition-colors">
            Não recebi o token
          </Link>
          {" • "}
          <Link to="/entrar" className="font-semibold text-primary hover:text-brand-green-dark transition-colors">
            Voltar ao login
          </Link>
        </p>
      </form>
    </div>
  );

  return (
    <main className="min-h-screen gradient-hero">
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

export default RedefinirSenha;


