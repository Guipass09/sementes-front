import { ImageIcon, Video } from "lucide-react";
import type { ActivityRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

export function ActivityThumbnail({ activity }: { activity: ActivityRow }): JSX.Element {
  const media = activity.media.find((item) => item.id === activity.thumbnail?.id && (item.media_type === "image" || item.thumbnail_url))
    ?? activity.media.find((item) => item.media_type === "image" || item.thumbnail_url)
    ?? activity.thumbnail
    ?? activity.media[0];
  const imageUrl = media?.media_type === "video" ? media.thumbnail_url : media?.url;

  return (
    <div className="relative flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-emerald-50 sm:h-24 sm:w-28">
      {media?.media_type === "video" ? <Video className="h-7 w-7 text-brand-green" /> : <ImageIcon className="h-7 w-7 text-brand-green" />}
      {imageUrl ? <img src={normalizeMediaUrl(imageUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
      {media?.media_type === "video" && imageUrl ? <span className="absolute bottom-1 right-1 rounded-sm bg-black/70 p-1 text-white"><Video className="h-3 w-3" /></span> : null}
    </div>
  );
}
