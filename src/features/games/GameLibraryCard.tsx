import { Link } from "react-router-dom";
import { Pencil, Play, Send, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SessionCatalogTile,
  type CatalogKind,
} from "@/features/session/SessionCatalogTile";

export const GAME_LIBRARY_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export function GameLibraryCard({
  title,
  description,
  subtitle,
  imageUrl,
  kind,
  playPath,
  editPath,
  onSend,
  onShare,
  onDelete,
  footer,
  playable = true,
}: {
  title: string;
  description?: string | null;
  subtitle?: string | null;
  imageUrl?: string | null;
  kind: CatalogKind;
  playPath: string;
  editPath?: string;
  onSend?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  footer?: string;
  playable?: boolean;
}) {
  const tile = (
    <SessionCatalogTile
      title={title}
      subtitle={subtitle}
      imageUrl={imageUrl}
      kind={kind}
    />
  );
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
      {playable ? (
        <Link
          to={playPath}
          className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`Jogar ${title}`}
        >
          {tile}
        </Link>
      ) : (
        <div>{tile}</div>
      )}
      {description && (
        <p className="mb-3 line-clamp-2 px-3 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          {description}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 px-3 pb-3">
        {playable ? (
          <Button asChild variant="outline" size="icon" title="Jogar">
            <Link to={playPath} aria-label={`Jogar ${title}`}>
              <Play size={17} />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            disabled
            title="História em rascunho"
            aria-label={`Jogar ${title}`}
          >
            <Play size={17} />
          </Button>
        )}
        {editPath && (
          <Button asChild variant="outline" size="icon" title="Editar">
            <Link to={editPath} aria-label={`Editar ${title}`}>
              <Pencil size={17} />
            </Link>
          </Button>
        )}
        {onSend && (
          <Button size="sm" onClick={onSend}>
            <Send size={16} className="mr-2" />
            Enviar
          </Button>
        )}
        {onShare && (
          <Button
            variant="outline"
            size="icon"
            title="Compartilhar com profissionais"
            aria-label={`Compartilhar ${title}`}
            onClick={onShare}
          >
            <Share2 size={17} />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="Excluir"
            aria-label={`Excluir ${title}`}
            onClick={onDelete}
          >
            <Trash2 size={17} />
          </Button>
        )}
      </div>
      {footer && (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {footer}
        </p>
      )}
    </article>
  );
}
