import { useState, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, Check, AlertCircle, User, Phone, BadgeCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { isApiError } from "@/lib/laravel-api";

type RegisterMode = "patient" | "professional";

interface FormState {
  name: string;
  email: string;
  phone: string;
  childAge: string;
  professionalAge: string;
  professionalCrfa: string;
  professionalRegistration: string;
  password: string;
  confirmPassword: string;
}

interface ValidationState {
  name: { valid: boolean; touched: boolean; message: string };
  email: { valid: boolean; touched: boolean; message: string };
  phone: { valid: boolean; touched: boolean; message: string };
  childAge: { valid: boolean; touched: boolean; message: string };
  professionalAge: { valid: boolean; touched: boolean; message: string };
  professionalCrfa: { valid: boolean; touched: boolean; message: string };
  professionalRegistration: { valid: boolean; touched: boolean; message: string };
  password: { valid: boolean; touched: boolean; message: string };
  confirmPassword: { valid: boolean; touched: boolean; message: string };
}

const RegisterForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const auth = useAuth();

  const [mode, setMode] = useState<RegisterMode>("patient");

  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    childAge: "",
    professionalAge: "",
    professionalCrfa: "",
    professionalRegistration: "",
    password: "",
    confirmPassword: "",
  });

  const [validation, setValidation] = useState<ValidationState>({
    name: { valid: false, touched: false, message: "" },
    email: { valid: false, touched: false, message: "" },
    phone: { valid: false, touched: false, message: "" },
    childAge: { valid: false, touched: false, message: "" },
    professionalAge: { valid: false, touched: false, message: "" },
    professionalCrfa: { valid: false, touched: false, message: "" },
    professionalRegistration: { valid: false, touched: false, message: "" },
    password: { valid: false, touched: false, message: "" },
    confirmPassword: { valid: false, touched: false, message: "" },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const validateName = useCallback((name: string): { valid: boolean; message: string } => {
    if (!name.trim()) {
      return { valid: false, message: "Nome é obrigatório" };
    }
    if (name.trim().length < 3) {
      return { valid: false, message: "Nome deve ter no mínimo 3 caracteres" };
    }
    return { valid: true, message: "" };
  }, []);

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

  const validatePhone = useCallback((phone: string): { valid: boolean; message: string } => {
    const digits = phone.replace(/\D+/g, "");
    if (!digits) {
      return { valid: false, message: "Celular é obrigatório" };
    }
    // Brasil: DDD (2) + celular (9 dígitos, começando com 9) = 11 dígitos
    if (digits.length !== 11) {
      return { valid: false, message: "Informe um celular com DDD (11 dígitos)" };
    }
    if (digits[2] !== "9") {
      return { valid: false, message: "Celular inválido (deve começar com 9 após o DDD)" };
    }
    return { valid: true, message: "" };
  }, []);

  const validateChildAge = useCallback((age: string): { valid: boolean; message: string } => {
    const s = String(age ?? "").trim();
    if (!s) return { valid: false, message: "Idade da criança é obrigatória" };
    const n = Number(s);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { valid: false, message: "Informe uma idade válida (número inteiro)" };
    }
    if (n < 0) return { valid: false, message: "Idade não pode ser negativa" };
    if (n > 120) return { valid: false, message: "Idade inválida" };
    return { valid: true, message: "" };
  }, []);

  const validateProfessionalAge = useCallback((age: string): { valid: boolean; message: string } => {
    const s = String(age ?? "").trim();
    if (!s) return { valid: false, message: "Idade do profissional é obrigatória" };
    const n = Number(s);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { valid: false, message: "Informe uma idade válida (número inteiro)" };
    }
    if (n < 18) return { valid: false, message: "Idade mínima é 18 anos" };
    if (n > 120) return { valid: false, message: "Idade inválida" };
    return { valid: true, message: "" };
  }, []);

  const validateProfessionalCrfa = useCallback((v: string): { valid: boolean; message: string } => {
    const s = String(v ?? "").trim();
    if (!s) return { valid: false, message: "CRFa é obrigatório" };
    if (s.length < 3) return { valid: false, message: "CRFa inválido" };
    return { valid: true, message: "" };
  }, []);

  const validateProfessionalRegistration = useCallback((v: string): { valid: boolean; message: string } => {
    const s = String(v ?? "").trim();
    if (!s) return { valid: false, message: "Registro profissional é obrigatório" };
    if (s.length < 3) return { valid: false, message: "Registro inválido" };
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

  const validateConfirmPassword = useCallback((confirmPassword: string, password: string): { valid: boolean; message: string } => {
    if (!confirmPassword) {
      return { valid: false, message: "Confirmação de senha é obrigatória" };
    }
    if (confirmPassword !== password) {
      return { valid: false, message: "As senhas não coincidem" };
    }
    return { valid: true, message: "" };
  }, []);

  const handleInputChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (validation[field].touched) {
      let result;
      switch (field) {
        case "name":
          result = validateName(value);
          break;
        case "email":
          result = validateEmail(value);
          break;
        case "phone":
          result = validatePhone(value);
          break;
        case "childAge":
          result = validateChildAge(value);
          break;
        case "professionalAge":
          result = validateProfessionalAge(value);
          break;
        case "professionalCrfa":
          result = validateProfessionalCrfa(value);
          break;
        case "professionalRegistration":
          result = validateProfessionalRegistration(value);
          break;
        case "password":
          result = validatePassword(value);
          // Also revalidate confirm password when password changes
          if (validation.confirmPassword.touched) {
            const confirmResult = validateConfirmPassword(formData.confirmPassword, value);
            setValidation((prev) => ({
              ...prev,
              confirmPassword: { ...confirmResult, touched: true },
            }));
          }
          break;
        case "confirmPassword":
          result = validateConfirmPassword(value, formData.password);
          break;
        default:
          return;
      }
      setValidation((prev) => ({
        ...prev,
        [field]: { ...result, touched: true },
      }));
    }
  };

  const handleInputBlur = (field: keyof FormState) => () => {
    let result;
    switch (field) {
      case "name":
        result = validateName(formData.name);
        break;
      case "email":
        result = validateEmail(formData.email);
        break;
      case "phone":
        result = validatePhone(formData.phone);
        break;
      case "childAge":
        result = validateChildAge(formData.childAge);
        break;
      case "professionalAge":
        result = validateProfessionalAge(formData.professionalAge);
        break;
      case "professionalCrfa":
        result = validateProfessionalCrfa(formData.professionalCrfa);
        break;
      case "professionalRegistration":
        result = validateProfessionalRegistration(formData.professionalRegistration);
        break;
      case "password":
        result = validatePassword(formData.password);
        break;
      case "confirmPassword":
        result = validateConfirmPassword(formData.confirmPassword, formData.password);
        break;
      default:
        return;
    }
    setValidation((prev) => ({
      ...prev,
      [field]: { ...result, touched: true },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError("");

    const nameResult = validateName(formData.name);
    const emailResult = validateEmail(formData.email);
    const phoneResult = validatePhone(formData.phone);
    const childAgeResult = mode === "patient" ? validateChildAge(formData.childAge) : { valid: true, message: "" };
    const professionalAgeResult = mode === "professional" ? validateProfessionalAge(formData.professionalAge) : { valid: true, message: "" };
    const professionalCrfaResult = mode === "professional" ? validateProfessionalCrfa(formData.professionalCrfa) : { valid: true, message: "" };
    const professionalRegistrationResult =
      mode === "professional" ? validateProfessionalRegistration(formData.professionalRegistration) : { valid: true, message: "" };
    const passwordResult = validatePassword(formData.password);
    const confirmPasswordResult = validateConfirmPassword(formData.confirmPassword, formData.password);

    setValidation({
      name: { ...nameResult, touched: true },
      email: { ...emailResult, touched: true },
      phone: { ...phoneResult, touched: true },
      childAge: { ...childAgeResult, touched: true },
      professionalAge: { ...professionalAgeResult, touched: true },
      professionalCrfa: { ...professionalCrfaResult, touched: true },
      professionalRegistration: { ...professionalRegistrationResult, touched: true },
      password: { ...passwordResult, touched: true },
      confirmPassword: { ...confirmPasswordResult, touched: true },
    });

    if (
      !nameResult.valid ||
      !emailResult.valid ||
      !phoneResult.valid ||
      !childAgeResult.valid ||
      !professionalAgeResult.valid ||
      !professionalCrfaResult.valid ||
      !professionalRegistrationResult.valid ||
      !passwordResult.valid ||
      !confirmPasswordResult.valid
    ) {
      return;
    }

    setIsButtonClicked(true);
    setIsSubmitting(true);
    try {
      if (mode === "professional") {
        await auth.registerProfessional({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          professional_age: Number(formData.professionalAge),
          professional_crfa: formData.professionalCrfa.trim(),
          professional_registration: formData.professionalRegistration.trim(),
          password: formData.password,
          password_confirmation: formData.confirmPassword,
        });
      } else {
        await auth.register({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          child_age: Number(formData.childAge),
          password: formData.password,
          password_confirmation: formData.confirmPassword,
        });
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao Sementes da Fala",
      });

      // O redirecionamento é feito pelo AuthContext.register() usando window.location.href
      // Não precisamos fazer navigate aqui, mas deixamos como fallback
      // O AuthContext já redireciona para /paciente automaticamente
    } catch (e) {
      if (isApiError(e) && e.status === 422) {
        const msg =
          e.data?.message ||
          e.data?.errors?.email?.[0] ||
          e.data?.errors?.phone?.[0] ||
          e.data?.errors?.child_age?.[0] ||
          e.data?.errors?.password?.[0] ||
          "Verifique os campos e tente novamente.";
        setRegisterError(msg);
      } else {
        setRegisterError("Não foi possível cadastrar agora. Tente novamente.");
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground">Paciente / Profissional</div>
        <div className="mt-3 inline-flex rounded-xl border border-border bg-background/70 p-1">
          <button
            type="button"
            onClick={() => setMode("patient")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mode === "patient" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Paciente
          </button>
          <button
            type="button"
            onClick={() => setMode("professional")}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              mode === "professional" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Profissional
          </button>
        </div>
      </div>
      {/* Register Error Message */}
      {registerError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle size={16} />
            {registerError}
          </p>
        </div>
      )}

      {/* Name Field */}
      <div className="space-y-2">
        <label 
          htmlFor="name" 
          className="block text-sm font-semibold text-foreground"
        >
          Nome
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <User size={18} />
          </div>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange("name")}
            onBlur={handleInputBlur("name")}
            placeholder="Seu nome completo"
            autoComplete="name"
            aria-label="Nome completo"
            aria-invalid={validation.name.touched && !validation.name.valid}
            className={`${getInputClassName("name")} pl-11 pr-10`}
          />
          {validation.name.touched && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {validation.name.valid ? (
                <Check size={18} className="text-primary" />
              ) : (
                <AlertCircle size={18} className="text-destructive" />
              )}
            </div>
          )}
        </div>
        {validation.name.touched && !validation.name.valid && (
          <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
            {validation.name.message}
          </p>
        )}
      </div>

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
            onChange={handleInputChange("email")}
            onBlur={handleInputBlur("email")}
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

      {/* Phone Field */}
      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-semibold text-foreground">
          Celular (DDD)
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Phone size={18} />
          </div>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange("phone")}
            onBlur={handleInputBlur("phone")}
            placeholder="(11) 9XXXX-XXXX"
            autoComplete="tel"
            inputMode="tel"
            aria-label="Celular com DDD"
            aria-invalid={validation.phone.touched && !validation.phone.valid}
            className={`${getInputClassName("phone")} pl-11 pr-10`}
          />
          {validation.phone.touched && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {validation.phone.valid ? (
                <Check size={18} className="text-primary" />
              ) : (
                <AlertCircle size={18} className="text-destructive" />
              )}
            </div>
          )}
        </div>
        {validation.phone.touched && !validation.phone.valid && (
          <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
            {validation.phone.message}
          </p>
        )}
      </div>

      {mode === "patient" ? (
        /* Child Age Field */
        <div className="space-y-2">
          <label htmlFor="childAge" className="block text-sm font-semibold text-foreground">
            Idade da Criança (anos)
          </label>
          <div className="relative">
            <input
              type="number"
              id="childAge"
              name="childAge"
              value={formData.childAge}
              onChange={handleInputChange("childAge")}
              onBlur={handleInputBlur("childAge")}
              placeholder="Ex: 7"
              inputMode="numeric"
              min={0}
              max={120}
              step={1}
              aria-label="Idade da criança em anos"
              aria-invalid={validation.childAge.touched && !validation.childAge.valid}
              className={`${getInputClassName("childAge")} pl-4 pr-10`}
            />
            {validation.childAge.touched && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {validation.childAge.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {validation.childAge.touched && !validation.childAge.valid && (
            <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.childAge.message}</p>
          )}
        </div>
      ) : (
        <>
          {/* Professional Age */}
          <div className="space-y-2">
            <label htmlFor="professionalAge" className="block text-sm font-semibold text-foreground">
              Idade do Profissional (anos)
            </label>
            <div className="relative">
              <input
                type="number"
                id="professionalAge"
                name="professionalAge"
                value={formData.professionalAge}
                onChange={handleInputChange("professionalAge")}
                onBlur={handleInputBlur("professionalAge")}
                placeholder="Ex: 28"
                inputMode="numeric"
                min={18}
                max={120}
                step={1}
                aria-label="Idade do profissional em anos"
                aria-invalid={validation.professionalAge.touched && !validation.professionalAge.valid}
                className={`${getInputClassName("professionalAge")} pl-4 pr-10`}
              />
              {validation.professionalAge.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.professionalAge.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.professionalAge.touched && !validation.professionalAge.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.professionalAge.message}</p>
            )}
          </div>

          {/* CRFa */}
          <div className="space-y-2">
            <label htmlFor="professionalCrfa" className="block text-sm font-semibold text-foreground">
              CRFa
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <BadgeCheck size={18} />
              </div>
              <input
                type="text"
                id="professionalCrfa"
                name="professionalCrfa"
                value={formData.professionalCrfa}
                onChange={handleInputChange("professionalCrfa")}
                onBlur={handleInputBlur("professionalCrfa")}
                placeholder="Ex: CRFa-2 12345"
                autoComplete="off"
                aria-label="CRFa"
                aria-invalid={validation.professionalCrfa.touched && !validation.professionalCrfa.valid}
                className={`${getInputClassName("professionalCrfa")} pl-11 pr-10`}
              />
              {validation.professionalCrfa.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.professionalCrfa.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.professionalCrfa.touched && !validation.professionalCrfa.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.professionalCrfa.message}</p>
            )}
          </div>

          {/* Registro profissional */}
          <div className="space-y-2">
            <label htmlFor="professionalRegistration" className="block text-sm font-semibold text-foreground">
              Registro do Profissional
            </label>
            <div className="relative">
              <input
                type="text"
                id="professionalRegistration"
                name="professionalRegistration"
                value={formData.professionalRegistration}
                onChange={handleInputChange("professionalRegistration")}
                onBlur={handleInputBlur("professionalRegistration")}
                placeholder="Ex: 123456"
                autoComplete="off"
                aria-label="Registro profissional"
                aria-invalid={validation.professionalRegistration.touched && !validation.professionalRegistration.valid}
                className={`${getInputClassName("professionalRegistration")} pl-4 pr-10`}
              />
              {validation.professionalRegistration.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.professionalRegistration.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.professionalRegistration.touched && !validation.professionalRegistration.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.professionalRegistration.message}</p>
            )}
          </div>
        </>
      )}

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
            onChange={handleInputChange("password")}
            onBlur={handleInputBlur("password")}
            placeholder="••••••••"
            autoComplete="new-password"
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

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <label 
          htmlFor="confirmPassword" 
          className="block text-sm font-semibold text-foreground"
        >
          Confirmar Senha
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Lock size={18} />
          </div>
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange("confirmPassword")}
            onBlur={handleInputBlur("confirmPassword")}
            placeholder="••••••••"
            autoComplete="new-password"
            aria-label="Confirmar senha"
            aria-invalid={validation.confirmPassword.touched && !validation.confirmPassword.valid}
            className={`${getInputClassName("confirmPassword")} pl-11 pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {validation.confirmPassword.touched && !validation.confirmPassword.valid && (
          <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">
            {validation.confirmPassword.message}
          </p>
        )}
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
            Cadastrando...
          </span>
        ) : (
          "Criar conta"
        )}
      </button>

      {/* Login Link */}
      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link 
          to="/entrar" 
          className="font-semibold text-primary hover:text-brand-green-dark transition-colors"
        >
          Fazer login
        </Link>
      </p>
    </form>
  );
};

export default RegisterForm;
