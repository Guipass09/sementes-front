import { Ear, FileImage, Grid2X2, Grid3X3, Headphones, Images, Layers3, RotateCw, WholeWord } from "lucide-react";
import { memo } from "react";
import type { ActivityRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

type GameCover = {
  thumbnail?: { url?: string | null; left_url?: string | null; right_url?: string | null; main_url?: string | null } | null;
  cards?: Array<{ url?: string | null }>;
  items?: Array<{ url?: string | null; image_url?: string | null; left_url?: string | null; right_url?: string | null; main_url?: string | null }>;
  support_images?: Array<{ url?: string | null }>;
  background_url?: string | null;
};

export function activityCatalogImage(activity: ActivityRow): string | null {
  const media = [activity.thumbnail, ...(activity.media ?? [])]
    .find((item) => item && (item.media_type === "image" ? item.url : item.thumbnail_url));
  return media?.media_type === "video" ? media.thumbnail_url ?? null : media?.url ?? null;
}

export function gameCatalogImage(game: GameCover): string | null {
  const item = game.items?.[0];
  return game.thumbnail?.url ?? game.thumbnail?.left_url ?? game.thumbnail?.main_url ?? game.thumbnail?.right_url
    ?? game.cards?.find((card) => card.url)?.url ?? item?.url ?? item?.image_url ?? item?.left_url
    ?? item?.main_url ?? item?.right_url ?? game.support_images?.[0]?.url ?? game.background_url ?? null;
}

const styles = {
  sound_image_game: { icon: Ear, color: "text-emerald-700", background: "bg-emerald-50" },
  image_sequence_game: { icon: Images, color: "text-sky-700", background: "bg-sky-50" },
  activity: { icon: Images, color: "text-emerald-700", background: "bg-emerald-50" },
  memory_game: { icon: Grid2X2, color: "text-emerald-700", background: "bg-emerald-50" },
  memory_game_v2: { icon: Grid3X3, color: "text-sky-700", background: "bg-sky-50" },
  phoneme_game: { icon: Ear, color: "text-violet-700", background: "bg-violet-50" },
  auditory_game: { icon: Headphones, color: "text-sky-700", background: "bg-sky-50" },
  hangman_game: { icon: WholeWord, color: "text-amber-700", background: "bg-amber-50" },
  spin_wheel_game: { icon: RotateCw, color: "text-orange-700", background: "bg-orange-50" },
  word_search_game: { icon: Grid3X3, color: "text-teal-700", background: "bg-teal-50" },
  card_game: { icon: Layers3, color: "text-rose-700", background: "bg-rose-50" },
  guess_image_game: { icon: FileImage, color: "text-pink-700", background: "bg-pink-50" },
} as const;

type CatalogKind = keyof typeof styles;

export const SessionCatalogTile = memo(function SessionCatalogTile({ title, subtitle, imageUrl, kind }: {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  kind: CatalogKind;
}): JSX.Element {
  const style = styles[kind];
  const Icon = style.icon;

  return <>
    <span className={`relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-t-md ${style.background}`}>
      <Icon className={`h-8 w-8 ${style.color}`} aria-hidden="true" />
      {imageUrl ? <img
        src={normalizeMediaUrl(imageUrl)}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-contain p-1.5"
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      /> : null}
    </span>
    <span className="block min-w-0 px-2.5 py-2.5">
      <span className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">{title}</span>
      <span className="mt-0.5 block h-4 truncate text-xs text-muted-foreground">{subtitle}</span>
    </span>
  </>;
});
