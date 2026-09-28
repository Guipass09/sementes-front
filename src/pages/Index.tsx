import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import LoginForm from "@/components/LoginForm";
import "./login.css";

const Index = () => {
  const navigate = useNavigate();

  // Redirecionar automaticamente se usuário já estiver logado
  useEffect(() => {
    try {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      
      if (token && storedUser) {
        const user = JSON.parse(storedUser);
        const role = String(user.role || "").toLowerCase().trim();
        const isAdmin = role === "admin" || role.includes("admin") || role.includes("administrador");
        
        // Redirecionar para área apropriada
        if (isAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/paciente", { replace: true });
        }
      }
    } catch {
      // Ignora erros de parse
    }
  }, [navigate]);

  return (
    <main className="auth-login">
      <header className="auth-login__nav">
        <Link to="/" className="auth-login__brand" aria-label="Sementes da Fala, página inicial">
          <img src="/landing/sementes-logo-transparent.png" alt="" width="68" height="68" />
          <span><strong>Sementes</strong> da Fala</span>
        </Link>
        <Link to="/" className="auth-login__back">
          <ArrowLeft size={17} />
          <span>Voltar ao site</span>
        </Link>
      </header>

      <div className="auth-login__grid">
        <section className="auth-login__photo" aria-labelledby="auth-login-title">
          <img
            src="/landing/teleatendimento-fono.png"
            alt="Fonoaudióloga atendendo uma criança por vídeo"
            fetchPriority="high"
          />
          <div className="auth-login__photo-shade" />
          <div className="auth-login__photo-copy">
            <p className="auth-login__eyebrow">SEU ESPAÇO DE ATENDIMENTO</p>
            <h1 id="auth-login-title">Sementes da Fala</h1>
            <p>Continue de onde parou.</p>
          </div>
        </section>

        <section className="auth-login__panel" aria-labelledby="auth-login-form-title">
          <div className="auth-login__form">
            <p className="auth-login__form-label">ACESSO À PLATAFORMA</p>
            <h2 id="auth-login-form-title">Bom ter você de volta.</h2>
            <p className="auth-login__form-intro">Entre na sua conta para continuar.</p>
            <LoginForm />
          </div>
          <footer className="auth-login__footer">
            © {new Date().getFullYear()} Sementes da Fala
          </footer>
        </section>
      </div>
    </main>
  );
};

export default Index;
