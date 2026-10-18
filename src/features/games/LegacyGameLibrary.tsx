import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import BrandedConfirmDialog from "@/components/BrandedConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { gameCatalogImage } from "@/features/session/SessionCatalogTile";
import { ShareGameModal } from "./ShareGameModal";
import { GameLibraryCard, GAME_LIBRARY_GRID } from "./GameLibraryCard";
import { gameLibraryApi } from "./game-library-api";
import {
  GAME_LIBRARIES,
  filterLibraryGames,
  gameLibraryCount,
  gameLibraryPermissions,
  gamePlayPath,
  type GameLibrarySlug,
  type LibraryGame,
} from "./game-library";

export default function LegacyGameLibrary({ slug }: { slug: GameLibrarySlug }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <LibraryWorkspace key={`${user.id}:${slug}`} slug={slug} user={user} />
  );
}

function LibraryWorkspace({
  slug,
  user,
}: {
  slug: GameLibrarySlug;
  user: api.AuthUser;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const professional = user.role === "professional";
  const base = professional ? "/profissional" : "/admin";
  const info = GAME_LIBRARIES[slug];
  const adapter = useMemo(
    () => gameLibraryApi(slug, professional),
    [slug, professional],
  );
  const queryKey = ["management-game-library", user.id, slug];
  const query = useQuery({ queryKey, queryFn: () => adapter.list() });
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState("all");
  const [page, setPage] = useState(1);
  const [sending, setSending] = useState<LibraryGame | null>(null);
  const [sharing, setSharing] = useState<LibraryGame | null>(null);
  const [deleting, setDeleting] = useState<LibraryGame | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const games: LibraryGame[] = query.data ?? [];
  const patients = useQuery({
    queryKey: ["game-library-recipients", user.id],
    enabled: !!sending,
    queryFn: async () =>
      professional
        ? (await api.professionalListUsers()).data
        : (await api.adminListUsers()).filter((item) => item.role === "user"),
  });
  const onError = (error: unknown) =>
    toast({
      title: "Não foi possível concluir",
      description: api.isApiError(error)
        ? String(error.data?.message ?? "Tente novamente.")
        : "Tente novamente em instantes.",
      variant: "destructive",
    });
  const remove = useMutation({
    mutationFn: (game: LibraryGame) => adapter.remove(game.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      setDeleting(null);
      toast({ title: "Jogo excluído" });
    },
    onError,
  });
  const assign = useMutation({
    mutationFn: ({
      game,
      selected,
    }: {
      game: LibraryGame;
      selected: number[];
    }) => api.assignGameLibraryRecipients(info.kind, game.id, selected),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      setSending(null);
      toast({ title: "Jogo enviado aos pacientes" });
    },
    onError,
  });
  const filtered = filterLibraryGames(games, search, patient);
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 24, currentPage * 24);
  const assignedPatients = [
    ...new Map(
      games
        .flatMap((game) => game.assigned_to ?? [])
        .map((item) => [item.id, item]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const recipients = (patients.data ?? []).filter((item) =>
    item.name
      .toLocaleLowerCase("pt-BR")
      .includes(patientSearch.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="flex-none"
            title="Voltar aos jogos"
            aria-label="Voltar aos jogos"
            onClick={() => navigate(`${base}/jogos`)}
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="min-w-0 font-display text-2xl font-semibold [overflow-wrap:anywhere]">
            {info.title}
          </h1>
        </div>
        <Button onClick={() => navigate(`${base}/jogos/${slug}/novo`)}>
          <Plus size={18} className="mr-2" />
          Novo jogo
        </Button>
      </header>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            size={18}
            className="absolute left-3 top-3 text-muted-foreground"
          />
          <Input
            className="pl-10"
            aria-label="Buscar jogos"
            placeholder="Buscar jogos..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-64"
          aria-label="Filtrar por paciente"
          value={patient}
          onChange={(event) => {
            setPatient(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Todos os pacientes</option>
          <option value="unassigned">Ainda não enviados</option>
          {assignedPatients.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <div
          className={GAME_LIBRARY_GRID}
          aria-label="Carregando biblioteca"
          role="status"
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="overflow-hidden rounded-lg border border-border"
            >
              <Skeleton className="aspect-[16/10] w-full rounded-none" />
              <div className="space-y-3 p-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div role="alert" className="border-y border-border py-8">
          <p>Não foi possível carregar a biblioteca.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : !filtered.length ? (
        <p className="border-y border-border py-10 text-sm text-muted-foreground">
          Nenhum jogo encontrado.
        </p>
      ) : (
        <>
          {([true, false] as const).map((own) => {
            const rows = visible.filter(
              (game) => (game.created_by.id === user.id) === own,
            );
            if (!rows.length) return null;
            return (
              <section
                key={String(own)}
                className="mb-8"
                aria-label={own ? "Minha biblioteca" : "Compartilhados"}
              >
                <h2 className="mb-4 font-semibold">
                  {own
                    ? "Minha biblioteca"
                    : professional
                      ? "Compartilhados"
                      : "Biblioteca dos profissionais"}
                </h2>
                <div className={GAME_LIBRARY_GRID}>
                  {rows.map((game) => {
                    const permissions = gameLibraryPermissions(
                      slug,
                      game,
                      user,
                    );
                    const assigned = game.assigned_to?.length ?? 0;
                    return (
                      <GameLibraryCard
                        key={game.id}
                        title={game.title}
                        description={game.description}
                        subtitle={gameLibraryCount(game)}
                        imageUrl={gameCatalogImage(game)}
                        kind={info.kind}
                        playPath={gamePlayPath(slug, game.id)}
                        editPath={
                          permissions.edit
                            ? `${base}/jogos/${slug}/${game.id}/editar`
                            : undefined
                        }
                        onSend={
                          permissions.assign
                            ? () => {
                                setSending(game);
                                setSelected([]);
                                setPatientSearch("");
                              }
                            : undefined
                        }
                        onShare={
                          permissions.share ? () => setSharing(game) : undefined
                        }
                        onDelete={
                          permissions.delete
                            ? () => setDeleting(game)
                            : undefined
                        }
                        footer={[
                          assigned
                            ? `Enviado a ${assigned} paciente(s)`
                            : "Ainda não enviado",
                          !own ? `Por ${game.created_by.name}` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <span className="text-xs text-muted-foreground">
                {filtered.length} jogos · Página {currentPage} de {pages}
              </span>
              <Button
                variant="outline"
                size="icon"
                title="Página anterior"
                aria-label="Página anterior"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Próxima página"
                aria-label="Próxima página"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          )}
        </>
      )}
      <Dialog
        open={!!sending}
        onOpenChange={(open) => {
          if (!open && !assign.isPending) setSending(null);
        }}
      >
        <DialogContent className="flex max-h-[85svh] flex-col">
          <DialogHeader>
            <DialogTitle>Enviar aos pacientes</DialogTitle>
            <DialogDescription>{sending?.title}</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Buscar paciente"
            placeholder="Buscar paciente..."
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
          />
          <div className="min-h-0 space-y-3 overflow-auto py-2">
            {patients.isPending ? (
              <p role="status">Carregando pacientes...</p>
            ) : patients.isError ? (
              <div role="alert">
                <p>Não foi possível carregar os pacientes.</p>
                <Button
                  variant="outline"
                  onClick={() => void patients.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : recipients.length ? (
              recipients.map((item) => {
                const already = !!sending?.assigned_to?.some(
                  (recipient) => recipient.id === item.id,
                );
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <Checkbox
                      disabled={already || assign.isPending}
                      checked={already || selected.includes(item.id)}
                      onCheckedChange={(checked) =>
                        setSelected((ids) =>
                          checked
                            ? [...ids, item.id]
                            : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {item.name}
                    </span>
                    {already && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check size={14} />
                        Já enviado
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum paciente encontrado.
              </p>
            )}
          </div>
          <Button
            disabled={assign.isPending || !selected.length || !sending}
            onClick={() => {
              if (sending) assign.mutate({ game: sending, selected });
            }}
          >
            <Send size={16} className="mr-2" />
            {assign.isPending ? "Enviando..." : "Enviar jogo"}
          </Button>
        </DialogContent>
      </Dialog>
      {sharing && (
        <ShareGameModal
          open
          onOpenChange={(open) => {
            if (!open) setSharing(null);
          }}
          mode={professional ? "professional" : "admin"}
          gameId={sharing.id}
          gameType={info.shareType}
          title={sharing.title}
        />
      )}
      <BrandedConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
        title="Excluir jogo?"
        description={`O jogo “${deleting?.title ?? ""}” será removido da biblioteca e dos pacientes que o receberam.`}
        confirmLabel={remove.isPending ? "Excluindo..." : "Excluir"}
        variant="danger"
        onConfirm={() => {
          if (deleting && !remove.isPending) remove.mutate(deleting);
        }}
      />
    </div>
  );
}
