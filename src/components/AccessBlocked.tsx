import { Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface AccessBlockedProps {
  pageName: string;
}

const AccessBlocked = ({ pageName }: AccessBlockedProps) => {
  return (
    <div className="min-h-full py-8 lg:py-12 flex items-center justify-center">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-destructive" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-4">
            Acesso Bloqueado
          </h1>
          <p className="text-muted-foreground mb-6">
            O acesso à página de <strong>{pageName}</strong> foi bloqueado pelo administrador.
            Entre em contato com o suporte se acredita que isso é um erro.
          </p>
          <Link to="/paciente">
            <Button>
              <ArrowLeft size={16} className="mr-2" />
              Voltar para o Início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessBlocked;




















