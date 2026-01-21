import { useEffect, useState } from "react";
import type { ProfessionalUserRow } from "@/lib/laravel-api";
import { professionalListUsers } from "@/lib/laravel-api";
import { useToast } from "@/hooks/use-toast";

export default function ProfessionalHome(): JSX.Element {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ProfessionalUserRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await professionalListUsers();
        if (cancelled) return;
        setUsers(res.data ?? []);
      } catch {
        if (cancelled) return;
        toast({
          title: "Não foi possível carregar seus usuários",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Ambiente do Profissional</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aqui você verá apenas os usuários que o admin vinculou a você.
          </p>
        </div>
      </div>

      <div className="mt-6 bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Meus usuários</h2>
          <div className="text-sm text-muted-foreground">{loading ? "Carregando..." : `${users.length} usuário(s)`}</div>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-muted-foreground">Carregando lista...</div>
        ) : users.length === 0 ? (
          <div className="mt-4 text-sm text-muted-foreground">
            Nenhum usuário atribuído ainda. Peça para o admin vincular seus usuários.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div className="font-medium text-foreground">{u.name}</div>
                <div className="text-sm text-muted-foreground">
                  {u.email}
                  {u.phone ? ` • ${u.phone}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

