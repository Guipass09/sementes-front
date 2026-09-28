import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import RegisterForm from "@/components/RegisterForm";
import "./login.css";

const Cadastro = () => (
  <main className="auth-login auth-login--register">
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
      <section className="auth-login__photo" aria-labelledby="auth-register-title">
        <img
          src="/landing/cadastro-teleatendimento.png"
          alt="Criança e responsável participando de um atendimento fonoaudiológico online"
          fetchPriority="high"
        />
        <div className="auth-login__photo-shade" />
        <div className="auth-login__photo-copy">
          <p className="auth-login__eyebrow">UM ESPAÇO PARA CUIDAR E EVOLUIR</p>
          <h1 id="auth-register-title">Sementes da Fala</h1>
          <p>O atendimento começa aqui.</p>
        </div>
      </section>

      <section className="auth-login__panel" aria-labelledby="auth-register-form-title">
        <div className="auth-login__form">
          <p className="auth-login__form-label">FAÇA PARTE DA PLATAFORMA</p>
          <h2 id="auth-register-form-title">Crie sua conta.</h2>
          <p className="auth-login__form-intro">Escolha seu perfil para começar.</p>
          <RegisterForm />
        </div>
        <footer className="auth-login__footer">
          © {new Date().getFullYear()} Sementes da Fala
        </footer>
      </section>
    </div>
  </main>
);

export default Cadastro;
