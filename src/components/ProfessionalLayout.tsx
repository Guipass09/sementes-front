import { Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";

export default function ProfessionalLayout(): JSX.Element {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-[100svh]">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Ambiente do Profissional</div>
            <div className="text-xs text-muted-foreground truncate">{user?.name ?? ""}</div>
          </div>
          <Button variant="outline" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

