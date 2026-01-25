import { useState, useCallback } from "react";
import { Eye, EyeOff, Mail, Lock, Check, AlertCircle, User, Phone, BadgeCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import { isApiError } from "@/lib/laravel-api";

type RegisterMode = "patient" | "professional";

interface FormState {
  name: string; // profissional
  responsibleName: string; // paciente
  childName: string; // paciente
  childBirthdate: string; // YYYY-MM-DD
  email: string;
  phone: string;
  professionalBirthdate: string; // YYYY-MM-DD
  professionalCrfa: string;
  professionalAttestation: boolean;
  password: string;
  confirmPassword: string;
}

interface ValidationState {
  name: { valid: boolean; touched: boolean; message: string };
  responsibleName: { valid: boolean; touched: boolean; message: string };
  childName: { valid: boolean; touched: boolean; message: string };
  childBirthdate: { valid: boolean; touched: boolean; message: string };
  email: { valid: boolean; touched: boolean; message: string };
  phone: { valid: boolean; touched: boolean; message: string };
  professionalBirthdate: { valid: boolean; touched: boolean; message: string };
  professionalCrfa: { valid: boolean; touched: boolean; message: string };
  professionalAttestation: { valid: boolean; touched: boolean; message: string };
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
    responsibleName: "",
    childName: "",
    childBirthdate: "",
    email: "",
    phone: "",
    professionalBirthdate: "",
    professionalCrfa: "",
    professionalAttestation: false,
    password: "",
    confirmPassword: "",
  });

  const [validation, setValidation] = useState<ValidationState>({
    name: { valid: false, touched: false, message: "" },
    responsibleName: { valid: false, touched: false, message: "" },
    childName: { valid: false, touched: false, message: "" },
    childBirthdate: { valid: false, touched: false, message: "" },
    email: { valid: false, touched: false, message: "" },
    phone: { valid: false, touched: false, message: "" },
    professionalBirthdate: { valid: false, touched: false, message: "" },
    professionalCrfa: { valid: false, touched: false, message: "" },
    professionalAttestation: { valid: false, touched: false, message: "" },
    password: { valid: false, touched: false, message: "" },
    confirmPassword: { valid: false, touched: false, message: "" },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isButtonClicked, setIsButtonClicked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const validateName = useCallback((name: string, label = "Nome"): { valid: boolean; message: string } => {
    if (!name.trim()) {
      return { valid: false, message: `${label} é obrigatório` };
    }
    if (name.trim().length < 3) {
      return { valid: false, message: `${label} deve ter no mínimo 3 caracteres` };
    }
    return { valid: true, message: "" };
  }, []);

  const validateChildName = useCallback((name: string): { valid: boolean; message: string } => {
    const s = String(name ?? "").trim();
    if (!s) return { valid: false, message: "Nome da criança é obrigatório" };
    if (s.length < 2) return { valid: false, message: "Nome da criança inválido" };
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

  const validateBirthdate = useCallback(
    (value: string, opts?: { label?: string; minAgeYears?: number }): { valid: boolean; message: string } => {
      const label = opts?.label ?? "Data de nascimento";
      const s = String(value ?? "").trim();
      if (!s) return { valid: false, message: `${label} é obrigatória` };
      // Esperado: YYYY-MM-DD (input type="date")
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { valid: false, message: "Informe uma data válida" };
      const [yy, mm, dd] = s.split("-").map((n) => Number(n));
      if (!yy || !mm || !dd) return { valid: false, message: "Informe uma data válida" };
      const dt = new Date(yy, mm - 1, dd);
      if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== yy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) {
        return { valid: false, message: "Informe uma data válida" };
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dt.getTime() > today.getTime()) return { valid: false, message: "A data não pode ser no futuro" };

      if (typeof opts?.minAgeYears === "number") {
        const age = (() => {
          let a = today.getFullYear() - yy;
          const m = today.getMonth() + 1;
          const d = today.getDate();
          if (m < mm || (m === mm && d < dd)) a--;
          return a;
        })();
        if (age < opts.minAgeYears) return { valid: false, message: `Idade mínima é ${opts.minAgeYears} anos` };
      }

      return { valid: true, message: "" };
    },
    []
  );

  const validateProfessionalCrfa = useCallback((v: string): { valid: boolean; message: string } => {
    const s = String(v ?? "").trim();
    if (!s) return { valid: false, message: "CRFa é obrigatório" };
    if (s.length < 3) return { valid: false, message: "CRFa inválido" };
    return { valid: true, message: "" };
  }, []);

  const validateAttestation = useCallback((checked: boolean): { valid: boolean; message: string } => {
    if (!checked) {
      return { valid: false, message: "Você precisa confirmar a responsabilidade pelas informações" };
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
    const value = field === "professionalAttestation" ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value as any }));

    if (validation[field].touched) {
      let result;
      switch (field) {
        case "name":
          result = validateName(String(value), "Nome");
          break;
        case "responsibleName":
          result = validateName(String(value), "Nome do responsável");
          break;
        case "childName":
          result = validateChildName(String(value));
          break;
        case "childBirthdate":
          result = validateBirthdate(String(value), { label: "Data de nascimento da criança" });
          break;
        case "email":
          result = validateEmail(String(value));
          break;
        case "phone":
          result = validatePhone(String(value));
          break;
        case "professionalBirthdate":
          result = validateBirthdate(String(value), { label: "Data de nascimento", minAgeYears: 18 });
          break;
        case "professionalCrfa":
          result = validateProfessionalCrfa(String(value));
          break;
        case "professionalAttestation":
          result = validateAttestation(Boolean(value));
          break;
        case "password":
          result = validatePassword(String(value));
          // Also revalidate confirm password when password changes
          if (validation.confirmPassword.touched) {
            const confirmResult = validateConfirmPassword(formData.confirmPassword, String(value));
            setValidation((prev) => ({
              ...prev,
              confirmPassword: { ...confirmResult, touched: true },
            }));
          }
          break;
        case "confirmPassword":
          result = validateConfirmPassword(String(value), formData.password);
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
        result = validateName(formData.name, "Nome");
        break;
      case "responsibleName":
        result = validateName(formData.responsibleName, "Nome do responsável");
        break;
      case "childName":
        result = validateChildName(formData.childName);
        break;
      case "childBirthdate":
        result = validateBirthdate(formData.childBirthdate, { label: "Data de nascimento da criança" });
        break;
      case "email":
        result = validateEmail(formData.email);
        break;
      case "phone":
        result = validatePhone(formData.phone);
        break;
      case "professionalBirthdate":
        result = validateBirthdate(formData.professionalBirthdate, { label: "Data de nascimento", minAgeYears: 18 });
        break;
      case "professionalCrfa":
        result = validateProfessionalCrfa(formData.professionalCrfa);
        break;
      case "professionalAttestation":
        result = validateAttestation(formData.professionalAttestation);
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

    const nameResult = mode === "professional" ? validateName(formData.name, "Nome") : { valid: true, message: "" };
    const responsibleResult = mode === "patient" ? validateName(formData.responsibleName, "Nome do responsável") : { valid: true, message: "" };
    const childNameResult = mode === "patient" ? validateChildName(formData.childName) : { valid: true, message: "" };
    const childBirthdateResult =
      mode === "patient" ? validateBirthdate(formData.childBirthdate, { label: "Data de nascimento da criança" }) : { valid: true, message: "" };
    const emailResult = validateEmail(formData.email);
    const phoneResult = validatePhone(formData.phone);
    const professionalBirthdateResult =
      mode === "professional" ? validateBirthdate(formData.professionalBirthdate, { label: "Data de nascimento", minAgeYears: 18 }) : { valid: true, message: "" };
    const professionalCrfaResult = mode === "professional" ? validateProfessionalCrfa(formData.professionalCrfa) : { valid: true, message: "" };
    const professionalAttestationResult = mode === "professional" ? validateAttestation(formData.professionalAttestation) : { valid: true, message: "" };
    const passwordResult = validatePassword(formData.password);
    const confirmPasswordResult = validateConfirmPassword(formData.confirmPassword, formData.password);

    setValidation({
      name: { ...nameResult, touched: true },
      responsibleName: { ...responsibleResult, touched: true },
      childName: { ...childNameResult, touched: true },
      childBirthdate: { ...childBirthdateResult, touched: true },
      email: { ...emailResult, touched: true },
      phone: { ...phoneResult, touched: true },
      professionalBirthdate: { ...professionalBirthdateResult, touched: true },
      professionalCrfa: { ...professionalCrfaResult, touched: true },
      professionalAttestation: { ...professionalAttestationResult, touched: true },
      password: { ...passwordResult, touched: true },
      confirmPassword: { ...confirmPasswordResult, touched: true },
    });

    if (
      !nameResult.valid ||
      !responsibleResult.valid ||
      !childNameResult.valid ||
      !childBirthdateResult.valid ||
      !emailResult.valid ||
      !phoneResult.valid ||
      !professionalBirthdateResult.valid ||
      !professionalCrfaResult.valid ||
      !professionalAttestationResult.valid ||
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
          professional_birthdate: formData.professionalBirthdate,
          professional_crfa: formData.professionalCrfa.trim(),
          professional_attestation: formData.professionalAttestation,
          password: formData.password,
          password_confirmation: formData.confirmPassword,
        });
      } else {
        await auth.register({
          name: formData.responsibleName,
          responsible_name: formData.responsibleName,
          child_name: formData.childName,
          child_birthdate: formData.childBirthdate,
          email: formData.email,
          phone: formData.phone,
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
          e.data?.errors?.responsible_name?.[0] ||
          e.data?.errors?.child_name?.[0] ||
          e.data?.errors?.child_birthdate?.[0] ||
          e.data?.errors?.professional_birthdate?.[0] ||
          e.data?.errors?.professional_attestation?.[0] ||
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

      {mode === "patient" ? (
        <>
          {/* Responsible Name */}
          <div className="space-y-2">
            <label htmlFor="responsibleName" className="block text-sm font-semibold text-foreground">
              Nome do Responsável
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <User size={18} />
              </div>
              <input
                type="text"
                id="responsibleName"
                name="responsibleName"
                value={formData.responsibleName}
                onChange={handleInputChange("responsibleName")}
                onBlur={handleInputBlur("responsibleName")}
                placeholder="Nome completo do responsável"
                autoComplete="name"
                aria-label="Nome do responsável"
                aria-invalid={validation.responsibleName.touched && !validation.responsibleName.valid}
                className={`${getInputClassName("responsibleName")} pl-11 pr-10`}
              />
              {validation.responsibleName.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.responsibleName.valid ? (
                    <Check size={18} className="text-primary" />
                  ) : (
                    <AlertCircle size={18} className="text-destructive" />
                  )}
                </div>
              )}
            </div>
            {validation.responsibleName.touched && !validation.responsibleName.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.responsibleName.message}</p>
            )}
          </div>

          {/* Child Name */}
          <div className="space-y-2">
            <label htmlFor="childName" className="block text-sm font-semibold text-foreground">
              Nome da Criança
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <User size={18} />
              </div>
              <input
                type="text"
                id="childName"
                name="childName"
                value={formData.childName}
                onChange={handleInputChange("childName")}
                onBlur={handleInputBlur("childName")}
                placeholder="Nome completo da criança"
                autoComplete="off"
                aria-label="Nome da criança"
                aria-invalid={validation.childName.touched && !validation.childName.valid}
                className={`${getInputClassName("childName")} pl-11 pr-10`}
              />
              {validation.childName.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.childName.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.childName.touched && !validation.childName.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.childName.message}</p>
            )}
          </div>

          {/* Child Birthdate */}
          <div className="space-y-2">
            <label htmlFor="childBirthdate" className="block text-sm font-semibold text-foreground">
              Data de Nascimento da Criança
            </label>
            <div className="relative">
              <input
                type="date"
                id="childBirthdate"
                name="childBirthdate"
                value={formData.childBirthdate}
                onChange={handleInputChange("childBirthdate")}
                onBlur={handleInputBlur("childBirthdate")}
                aria-label="Data de nascimento da criança"
                aria-invalid={validation.childBirthdate.touched && !validation.childBirthdate.valid}
                className={`${getInputClassName("childBirthdate")} pl-4 pr-10`}
              />
              {validation.childBirthdate.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.childBirthdate.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.childBirthdate.touched && !validation.childBirthdate.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.childBirthdate.message}</p>
            )}
          </div>
        </>
      ) : (
        /* Professional Name */
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-semibold text-foreground">
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
                {validation.name.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
              </div>
            )}
          </div>
          {validation.name.touched && !validation.name.valid && (
            <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.name.message}</p>
          )}
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
        null
      ) : (
        <>
          {/* Professional Birthdate */}
          <div className="space-y-2">
            <label htmlFor="professionalBirthdate" className="block text-sm font-semibold text-foreground">
              Data de Nascimento
            </label>
            <div className="relative">
              <input
                type="date"
                id="professionalBirthdate"
                name="professionalBirthdate"
                value={formData.professionalBirthdate}
                onChange={handleInputChange("professionalBirthdate")}
                onBlur={handleInputBlur("professionalBirthdate")}
                aria-label="Data de nascimento do profissional"
                aria-invalid={validation.professionalBirthdate.touched && !validation.professionalBirthdate.valid}
                className={`${getInputClassName("professionalBirthdate")} pl-4 pr-10`}
              />
              {validation.professionalBirthdate.touched && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {validation.professionalBirthdate.valid ? <Check size={18} className="text-primary" /> : <AlertCircle size={18} className="text-destructive" />}
                </div>
              )}
            </div>
            {validation.professionalBirthdate.touched && !validation.professionalBirthdate.valid && (
              <p className="text-sm text-destructive animate-fade-in flex items-center gap-1">{validation.professionalBirthdate.message}</p>
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

          {/* Attestation */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">Responsabilidade</label>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background/70 p-3">
              <input
                type="checkbox"
                checked={formData.professionalAttestation}
                onChange={handleInputChange("professionalAttestation")}
                aria-label="Confirmo a responsabilidade pelas informações"
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0">
                <div className="text-sm text-foreground">
                  Declaro que as informações fornecidas são verdadeiras e me responsabilizo por elas.
                </div>
                {validation.professionalAttestation.touched && !validation.professionalAttestation.valid && (
                  <div className="text-sm text-destructive mt-1">{validation.professionalAttestation.message}</div>
                )}
              </div>
            </label>
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
