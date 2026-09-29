import { Gamepad2, Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type PrivateGame = {
  id: number;
  title: string;
  description?: string | null;
  assigned_to?: Array<{ id: number }>;
  created_by?: { id: number } | null;
  thumbnail?: { url?: string; image_url?: string; main_url?: string; left_url?: string } | null;
  background_url?: string | null;
  cards?: Array<{ url: string | null }>;
  items?: Array<{ url?: string; image_url?: string; main_url?: string; left_url?: string }>;
  support_images?: Array<{ url: string }>;
};

function coverUrl(game: PrivateGame): string | null {
  const item = game.items?.[0];
  return game.thumbnail?.url ?? game.thumbnail?.image_url ?? game.thumbnail?.main_url
    ?? game.thumbnail?.left_url ?? game.cards?.[0]?.url ?? item?.url ?? item?.image_url
    ?? item?.main_url ?? item?.left_url ?? game.support_images?.[0]?.url
    ?? game.background_url ?? null;
}

export function PrivateGamesShelf<T extends PrivateGame>(props: {
  games: T[];
  ownerId: number;
  editPath: (id: number) => string;
  onDelete: (game: T) => void;
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
          <div key={game.id} className="flex gap-4 rounded-md border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-emerald-50 sm:h-28 sm:w-28">
              <Gamepad2 className="h-9 w-9 text-brand-green" />
              {coverUrl(game) ? <img src={normalizeMediaUrl(coverUrl(game)!)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="line-clamp-2 font-semibold text-foreground">{game.title}</div>
              {game.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p> : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
              <Button size="sm" onClick={() => navigate(props.editPath(game.id))}>
                <Send className="mr-1.5 h-4 w-4" /> Editar e enviar
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => props.onDelete(game)}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
              </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
