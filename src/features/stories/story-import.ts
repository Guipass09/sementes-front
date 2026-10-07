import type { ActivityMediaRow, ActivityRow } from "@/lib/laravel-api";

export function activitySlides(activity: Pick<ActivityRow, "is_story" | "media">): ActivityMediaRow[] {
  if (activity.is_story) return [];
  return [...activity.media].sort((a, b) => a.position - b.position || a.id - b.id);
}
