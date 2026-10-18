import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CalendarDays, ClipboardList, FileText, Gamepad2, RefreshCw, type LucideIcon } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useAccessControl } from "@/hooks/use-access-control";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { usePatientLibrary } from "@/features/patient-library/usePatientLibrary";
import { newestFirst } from "@/features/patient-library/recent-content";
import { gameNoticeKey, markGameOpened, readGameNotices, reconcileGameNotices, saveGameNotices } from "./game-notices";

const statusLabels = { disponivel: "Disponível", em_andamento: "Em andamento", concluida: "Concluída" };

export default function PatientHome() {
  const { user } = useAuth();
  const location = useLocation();
  const { checkAccess } = useAccessControl();
  const isPreview = location.pathname.startsWith("/preview-paciente");
  const base = isPreview ? "/preview-paciente" : "/paciente";
  const { activities, categories, loading, refreshing, hasErrors, refresh } = usePatientLibrary();
  const recentActivities = newestFirst(activities, activity => activity.created_at).slice(0, 4);
  const recentGames = newestFirst(categories.flatMap(category => category.items.map(game => ({ game, category }))), entry => entry.game.createdAt).slice(0, 4);
  const shortcuts = [
    { path: base + "/atividades", label: "Atividades", icon: ClipboardList },
    { path: base + "/jogos", label: "Jogos", icon: Gamepad2 },
    ...(isPreview || checkAccess("horarios") ? [{ path: base + "/sessoes", label: "Sessões", icon: CalendarDays }] : []),
    { path: base + "/relatorios", label: "Relatórios", icon: FileText },
  ];

  const markRecentGameOpened = (categoryId: string, gameId: number) => {
    if (!user || hasErrors) return;
    const keys = categories.flatMap(category => category.items.map(game => gameNoticeKey(category.id, game.id)));
    const state = reconcileGameNotices(readGameNotices(user.id), keys);
    saveGameNotices(user.id, markGameOpened(state, gameNoticeKey(categoryId, gameId)));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words font-display text-2xl font-bold text-foreground">{user ? "Olá, " + user.name.split(" ")[0] : "Seu acompanhamento"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Novidades do seu acompanhamento</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing || isPreview} aria-label="Atualizar conteúdos" title="Atualizar conteúdos" className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/40 disabled:opacity-50">
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      <nav aria-label="Acesso rápido" className="mb-8 flex flex-wrap gap-2">
        {shortcuts.map(shortcut => (
          <Link key={shortcut.path} to={shortcut.path} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5">
            <shortcut.icon size={17} className="text-brand-green-dark" />{shortcut.label}
          </Link>
        ))}
      </nav>

      {hasErrors && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <span>Alguns conteúdos não puderam ser carregados.</span>
          <button type="button" onClick={() => void refresh()} disabled={refreshing} className="font-semibold text-primary underline underline-offset-4 disabled:opacity-50">Tentar novamente</button>
        </div>
      )}

      <section aria-labelledby="recent-activities-heading" className="border-t border-border py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-activities-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-foreground"><ClipboardList size={20} className="text-brand-green-dark" />Atividades recentes</h2>
          <Link to={base + "/atividades?ordem=recentes"} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-green-dark">Ver todas <ArrowRight size={16} /></Link>
        </div>
        {loading ? <LoadingTiles /> : !recentActivities.length ? (
          <p className="py-6 text-sm text-muted-foreground">As atividades disponibilizadas para você aparecerão aqui.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentActivities.map(activity => (
              <ResourceTile key={activity.id} path={"/atividades/" + activity.id} title={activity.title} meta={activity.category || "Atividade"} detail={statusLabels[activity.status ?? "disponivel"]} imageUrl={activity.thumbnail?.media_type === "video" ? activity.thumbnail.thumbnail_url : activity.thumbnail?.url} icon={ClipboardList} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-games-heading" className="border-t border-border py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-games-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-foreground"><Gamepad2 size={20} className="text-brand-green-dark" />Jogos recentes</h2>
          <Link to={base + "/jogos?recentes=1"} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-brand-green-dark">Ver todos <ArrowRight size={16} /></Link>
        </div>
        {loading ? <LoadingTiles /> : !recentGames.length ? (
          <p className="py-6 text-sm text-muted-foreground">Os jogos disponibilizados para você aparecerão aqui.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentGames.map(({ game, category }) => (
              <ResourceTile key={category.id + "-" + game.id} path={game.path} title={game.title} meta={category.title} detail={game.detail} imageUrl={game.imageUrl} icon={category.icon} onOpen={() => markRecentGameOpened(category.id, game.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResourceTile({ path, title, meta, detail, imageUrl, icon: Icon, onOpen }: {
  path: string; title: string; meta: string; detail: string; imageUrl?: string | null; icon: LucideIcon; onOpen?: () => void;
}) {
  return (
    <Link to={path} onClick={onOpen} className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-muted/40">
        <Icon size={32} strokeWidth={1.5} className="text-brand-green-dark/60" aria-hidden="true" />
        {imageUrl && <img src={normalizeMediaUrl(imageUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" onError={event => { event.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 break-words text-sm font-semibold leading-5 text-foreground">{title}</h3>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="min-w-0 truncate text-xs text-muted-foreground">{detail}</span>
          <ArrowRight size={16} className="flex-none text-brand-green-dark transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

function LoadingTiles() {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Carregando conteúdos">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="aspect-[4/3] rounded-lg" />)}</div>;
}
