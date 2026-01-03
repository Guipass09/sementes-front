import { useState, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, Check, AlertCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { isApiError } from "@/lib/laravel-api";

interface FormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ValidationState {
  email: { valid: boolean; touched: boolean; message: string };
  password: { valid: boolean; touched: boolean; message: string };
}

const LoginForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();
  
  const [formData, setFormData] = useState<FormState>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [validation, setValidation] = useState<ValidationState>({
    email: { valid: false, touched: false, message: "" },
    password: { valid: false, touched: false, message: "" },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const validateEmail = useCallback((email: string): { valid: boolean; message: string } => {
    if (!email.trim()) {
      return { valid: false, message: "Email é obrigatório" };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, message: "Digite um email válido" };
    }
    return { valid: true, message: "" };
  }, []);

  const validatePassword = useCallback((password: string): { valid: boolean; message: string } => {
    if (!password) {
      return { valid: false, message: "Senha é obrigatória" };
    }
    if (password.length < 6) {
      return { valid: false, message: "Senha deve ter no mínimo 6 caracteres" };
    }
    return { valid: true, message: "" };
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, email: value }));
    
    if (validation.email.touched) {
      const result = validateEmail(value);
      setValidation((prev) => ({
        ...prev,
        email: { ...result, touched: true },
      }));
    }
  };

  const handleEmailBlur = () => {
    const result = validateEmail(formData.email);
    setValidation((prev) => ({
      ...prev,
      email: { ...result, touched: true },
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, password: value }));
    
    if (validation.password.touched) {
      const result = validatePassword(value);
      setValidation((prev) => ({
        ...prev,
        password: { ...result, touched: true },
      }));
    }
  };

  const handlePasswordBlur = () => {
    const result = validatePassword(formData.password);
    setValidation((prev) => ({
      ...prev,
      password: { ...result, touched: true },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const emailResult = validateEmail(formData.email);
    const passwordResult = validatePassword(formData.password);

    setValidation({
      email: { ...emailResult, touched: true },
      password: { ...passwordResult, touched: true },
    });

    if (!emailResult.valid || !passwordResult.valid) {
      return;
    }

    setIsButtonClicked(true);
    setIsSubmitting(true);

    try {
      const user = await auth.login({
        email: formData.email,
        password: formData.password,
        remember: formData.rememberMe,
      });

      toast({
        title: "Login realizado com sucesso!",
        description:
          user.role === "admin"
            ? "Bem-vindo ao painel administrativo"
            : "Bem-vindo ao Sementes da Fala",
      });

      navigate(user.role === "admin" ? "/admin" : "/paciente");
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 422) {
          setLoginError("Email ou senha incorretos. Por favor, tente novamente.");
        } else if (e.status === 419) {
          setLoginError("Sessão expirada/CSRF. Recarregue a página e tente novamente.");
        } else if (e.status === 401) {
          setLoginError("Não autenticado. Tente novamente.");
        } else if (e.status === 403) {
          setLoginError("Acesso negado.");
        } else {
          setLoginError(e.data?.message || `Não foi possível entrar (erro ${e.status}).`);
        }
        // Ajuda no diagnóstico (DevTools)
        console.error("Login API error:", e.status, e.data);
      } else {
        setLoginError("Não foi possível entrar agora. Verifique sua conexão e tente novamente.");
        console.error("Login unknown error:", e);
      }
      setIsButtonClicked(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (field: keyof ValidationState) => {
    const base = "input-field";
    if (!validation[field].touched) return base;
    return `${base} ${validation[field].valid ? "success" : "error"}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Login Error Message */}
      {loginError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle size={16} />
            {loginError}
          </p>
        </div>
      )}

      {/* Email Field */}
      <div className="space-y-2">
        <label 
          htmlFor="email" 
          className="block text-sm font-semibold text-foreground"
        >
          Email
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Mail size={18} />
          </div>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            placeholder="seu@email.com"
            autoComplete="email"
            aria-label="Endereço de email"
            aria-invalid={validation.email.touched && !validation.email.valid}
            className={`${getInputClassName("email")} pl-11 pr-10`}
          />
          {validation.email.touched && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {validation.email.valid ? (
                <Check size={18} className="text-primary" />
              ) : (
                <AlertCircle size={18} className="text-destructive" />
              )}
            </div>
          )}
        </div>
        {validation.email.touched && !validation.email.valid && (
          <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
            {validation.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label 
          htmlFor="password" 
          className="block text-sm font-semibold text-foreground"
        >
          Senha
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Lock size={18} />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password}
            onChange={handlePasswordChange}
            onBlur={handlePasswordBlur}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-label="Senha"
            aria-invalid={validation.password.touched && !validation.password.valid}
            className={`${getInputClassName("password")} pl-11 pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {validation.password.touched && !validation.password.valid && (
          <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
            {validation.password.message}
          </p>
        )}
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => setFormData((prev) => ({ ...prev, rememberMe: e.target.checked }))}
              className="sr-only peer"
              aria-label="Lembrar minha senha"
            />
            <div className="w-5 h-5 border-2 border-input rounded-md bg-background peer-checked:bg-primary peer-checked:border-primary transition-all duration-200 group-hover:border-primary/50">
              <Check 
                size={14} 
                className="text-primary-foreground opacity-0 peer-checked:opacity-100 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity" 
              />
            </div>
            <Check 
              size={14} 
              className={`text-primary-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity ${formData.rememberMe ? 'opacity-100' : 'opacity-0'}`} 
            />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            Lembrar senha
          </span>
        </label>
        
        <Link
          to="/esqueci-senha"
          className="text-sm font-medium text-primary hover:text-brand-green-dark transition-colors"
        >
          Esqueci minha senha
        </Link>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`btn-primary ${isButtonClicked ? 'clicked' : ''} ${isSubmitting ? 'opacity-80' : ''}`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Entrando...
          </span>
        ) : (
          "Entrar"
        )}
      </button>

      {/* Register Link */}
      <p className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{" "}
        <Link 
          to="/cadastro" 
          className="font-semibold text-primary hover:text-brand-green-dark transition-colors"
        >
          Criar cadastro
        </Link>
      </p>
    </form>
  );
};

export default LoginForm;
