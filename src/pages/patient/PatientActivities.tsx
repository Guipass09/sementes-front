import { CheckCircle2, Clock, Play, FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/auth/AuthContext";
import type { ActivityRow } from "@/lib/laravel-api";
import * as api from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import { onUserProgressChanged } from "@/lib/user-events";

const statusConfig = {
  disponivel: {
    label: "Disponível",
    color: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
    icon: Play,
  },
  em_andamento: {
    label: "Em andamento",
    color: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
    icon: Clock,
  },
  concluida: {
    label: "Concluída",
    color: "bg-brand-green/10 text-brand-green border-brand-green/20",
    icon: CheckCircle2,
  },
};

const PatientActivities = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityRow[]>([]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const a = await api.userListActivities();
        if (!cancelled) {
          setActivities(a);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const off = onUserProgressChanged(() => void load());

    return () => {
      cancelled = true;
      off();
    };
  }, [auth.user]);

  const progressSummary = useMemo(() => {
    const total = activities.length;
    const done = activities.filter((a) => a.status === "concluida").length;
    const inProgress = activities.filter((a) => a.status === "em_andamento").length;
    const available = Math.max(0, total - done - inProgress);
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, inProgress, available, percent };
  }, [activities]);

  return (
    <div className="min-h-full py-8 lg:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
            Atividades
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e realize as atividades terapêuticas em casa
          </p>
        </div>

        {/* Progress Summary */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Progresso das Atividades</h3>
              <p className="text-sm text-muted-foreground">
                {progressSummary.total === 0
                  ? "Nenhuma atividade disponível ainda."
                  : `${progressSummary.done} de ${progressSummary.total} atividades concluídas`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 sm:w-48 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-brand-green to-brand-green-dark rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, progressSummary.percent))}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-brand-green">
                {progressSummary.percent}%
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{progressSummary.total}</span>
            </span>
            <span className="px-2 py-1 rounded-full border border-brand-green/20 bg-brand-green/10 text-brand-green">
              Concluídas: <span className="font-semibold">{progressSummary.done}</span>
            </span>
            <span className="px-2 py-1 rounded-full border border-brand-orange/20 bg-brand-orange/10 text-brand-orange">
              Em andamento: <span className="font-semibold">{progressSummary.inProgress}</span>
            </span>
            <span className="px-2 py-1 rounded-full border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
              Disponíveis: <span className="font-semibold">{progressSummary.available}</span>
            </span>
          </div>
        </div>

        {/* Activities List */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-8 w-28 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 shadow-sm text-center">
              <ImageIcon size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma atividade disponível ainda.</p>
            </div>
          ) : (
            activities.map((activity, index) => {
              const status = activity.status ?? "disponivel";
              const StatusIcon = statusConfig[status].icon;
              const thumb = activity.thumbnail;
              return (
                <button
                  type="button"
                  key={activity.id}
                  onClick={() => navigate(`/atividades/${activity.id}`)}
                  className="w-full text-left bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {thumb?.media_type === "image" ? (
                        <img
                          src={normalizeMediaUrl(thumb.url)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                      ) : thumb?.media_type === "video" && thumb.thumbnail_url ? (
                        <img
                          src={normalizeMediaUrl(thumb.thumbnail_url)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                      ) : thumb?.media_type === "video" ? (
                        <Play size={22} className="text-primary" />
                      ) : (
                        <ImageIcon size={22} className="text-primary" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{activity.title}</h3>
                        {activity.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {activity.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-3 text-sm">
                        {activity.estimated_time && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock size={14} />
                            {activity.estimated_time}
                          </span>
                        )}
                        <span className="text-muted-foreground flex items-center gap-1">
                          <FileText size={14} />
                          {activity.media?.length ?? 0} etapa(s)
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig[status].color}`}
                    >
                      <StatusIcon size={14} />
                      {statusConfig[status].label}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientActivities;
