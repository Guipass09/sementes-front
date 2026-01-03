import { Play, Clock, Tag } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { ActivityRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

const LOGO_CANDIDATES = ["/logo-relatorio.png", "/logo-relatorio.jpg", "/logo-relatorio.webp"] as const;

function sortMedia(a: ActivityRow["media"]): ActivityRow["media"] {
  return [...a].sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
}

export default function ActivityContent({ activity }: { activity: ActivityRow }) {
  const media = sortMedia(activity.media || []);

  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
              <img
                src={LOGO_CANDIDATES[0]}
                alt="Sementes da Fala"
                className="w-14 h-14 rounded-lg object-contain"
                onError={(e) => {
                  const current = e.currentTarget.src;
                  const idx = LOGO_CANDIDATES.findIndex((u) => current.endsWith(u));
                  const next = idx >= 0 ? LOGO_CANDIDATES[idx + 1] : null;
                  if (next) {
                    e.currentTarget.src = next;
                    return;
                  }
                  e.currentTarget.src = logoImage;
                }}
              />
              <div className="flex-1">
                <div className="text-lg font-display font-bold">
                  <span className="text-brand-green">Sementes</span>{" "}
                  <span className="text-brand-brown">da Fala</span>
                </div>
                <div className="text-sm text-slate-600">Atividade terapêutica</div>
              </div>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-display font-bold text-slate-900">{activity.title}</h2>
              <p className="text-slate-700 mt-2 leading-relaxed">{activity.description}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {activity.category && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
                    <Tag size={14} />
                    {activity.category}
                  </span>
                )}
                {activity.estimated_time && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
                    <Clock size={14} />
                    {activity.estimated_time}
                  </span>
                )}
                {activity.created_by?.role === "admin" && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                    Criado por Admin
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6">
              {media.length > 0 ? (
                <div className="relative">
                  <Carousel opts={{ loop: true }} className="w-full">
                    <CarouselContent>
                      {media.map((m) => (
                        <CarouselItem key={m.id}>
                          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                            <div className="relative bg-black/5">
                              {m.media_type === "image" ? (
                                <img
                                  src={normalizeMediaUrl(m.url)}
                                  alt="Mídia da atividade"
                                  className="w-full h-[240px] sm:h-[360px] object-contain bg-white"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.src = "/placeholder.svg";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-[240px] sm:h-[360px] flex items-center justify-center bg-black">
                                  <video
                                    src={normalizeMediaUrl(m.url)}
                                    poster={
                                      m.thumbnail_url
                                        ? normalizeMediaUrl(m.thumbnail_url)
                                        : activity.thumbnail?.media_type === "image"
                                          ? normalizeMediaUrl(activity.thumbnail.url)
                                          : undefined
                                    }
                                    controls
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="p-4 sm:p-5">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-1">
                                <Play size={16} className="text-brand-green" />
                                Etapa da atividade
                              </div>
                              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {m.caption?.trim() ? m.caption : "Sem descrição para esta etapa."}
                              </p>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 sm:-left-10" />
                    <CarouselNext className="right-2 sm:-right-10" />
                  </Carousel>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
                  Esta atividade ainda não possui fotos ou vídeos.
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Sementes da Fala • Conteúdo para acompanhamento terapêutico</span>
              <span>Confidencial</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
