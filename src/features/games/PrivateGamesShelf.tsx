import { Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

type PrivateGame = {
  id: number;
  title: string;
  description?: string | null;
  assigned_to?: Array<{ id: number }>;
  created_by?: { id: number } | null;
};

export function PrivateGamesShelf<T extends PrivateGame>(props: {
  games: T[];
  ownerId: number;
  editPath: (id: number) => string;
}): JSX.Element | null {
  const navigate = useNavigate();
  const privateGames = props.games.filter(
    (game) => game.created_by?.id === props.ownerId && (game.assigned_to?.length ?? 0) === 0,
  );
  if (!privateGames.length) return null;

  return (
    <section className="mb-6" aria-label="Jogos no meu perfil">
      <h2 className="mb-3 text-lg font-semibold">No meu perfil</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {privateGames.map((game) => (
          <div key={game.id} className="rounded-md border border-border bg-card p-4">
            <div className="font-medium text-foreground">{game.title}</div>
            {game.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(props.editPath(game.id))}>
                <Send className="mr-1.5 h-4 w-4" /> Editar e enviar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
