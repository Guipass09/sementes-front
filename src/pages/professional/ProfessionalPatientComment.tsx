import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { Skeleton } from "@/components/ui/skeleton";

const formatYmd = (ymd?: string | null) => {
  if (!ymd) return "";
  const dt = new Date(ymd + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
};

const patientDisplayName = (p: { name: string; child_name?: string | null }) => (p.child_name?.trim() ? p.child_name.trim() : p.name);

export default function ProfessionalPatientComment(): JSX.Element {
  const { id } = useParams();
  const userId = useMemo(() => Number(id), [id]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<api.ProfessionalPatientAdminComment | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setError("Paciente inválido.");
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError("");
    void api
      .professionalGetPatientAdminComment(userId)
      .then((res) => {
        if (!mounted) return;
        setData(res);
      })
      .catch(() => {
        if (!mounted) return;
        setError("Não foi possível carregar as informações deste paciente.");
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <div className="min-h-full py-4 sm:py-6 md:py-8 lg:py-12">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-foreground mb-1 truncate">
              Comentário do Admin
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Perfil do paciente e observações enviadas pelo admin (somente você vê).
            </p>
          </div>
          <Link
            to="/profissional/horarios"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground hover:bg-background transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-20 w-full mt-3" />
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold">
                  {data.user.profile_photo_url ? (
                    <img src={normalizeMediaUrl(data.user.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    patientDisplayName(data.user).split(" ").map((n) => n[0]).join("").slice(0, 2)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground text-lg truncate">{patientDisplayName(data.user)}</div>
                  <div className="text-sm text-muted-foreground truncate">Email: {data.user.email}</div>
                  <div className="text-sm text-muted-foreground">Celular: {data.user.phone ?? "-"}</div>

                  {data.user.child_name?.trim() ? (
                    <>
                      <div className="text-sm text-muted-foreground">Nome da criança: {data.user.child_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Nome do responsável: {data.user.responsible_name?.trim() || data.user.name}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Nome do usuário: {data.user.name}</div>
                  )}

                  {data.user.child_birthdate ? (
                    <div className="text-sm text-muted-foreground">Data de nascimento: {formatYmd(data.user.child_birthdate)}</div>
                  ) : data.user.child_age !== null && data.user.child_age !== undefined ? (
                    <div className="text-sm text-muted-foreground">Idade: {data.user.child_age} ano(s)</div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Data de nascimento: -</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <MessageSquareText className="h-5 w-5 text-brand-green" />
                Comentário do admin
              </div>
              {data.comment?.comment?.trim() ? (
                <div className="mt-3 rounded-lg border border-border bg-muted/20 p-4 whitespace-pre-wrap text-sm text-foreground">
                  {data.comment.comment}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">Nenhum comentário enviado pelo admin para este paciente.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum dado encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}

