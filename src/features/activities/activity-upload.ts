import type { ActivityMediaRow, ActivityMediaType } from "../../lib/laravel-api";

export const MAX_ACTIVITY_UPLOAD_BYTES = 95 * 1024 * 1024;

export function activityUploadError(file: File, label: string, thumbnail?: File | null): string | null {
  if (file.size + (thumbnail?.size ?? 0) > MAX_ACTIVITY_UPLOAD_BYTES) {
    return `${label}: o arquivo e a capa juntos excedem 95 MB. Reduza o tamanho antes de enviar.`;
  }
  return null;
}

export type ActivityUploadDraft = {
  id: string;
  file: File | null;
  thumbnail: File | null;
  media_type: ActivityMediaType;
  caption: string;
};

export async function uploadActivityDrafts(
  activityId: number,
  drafts: ActivityUploadDraft[],
  existingMedia: ActivityMediaRow[],
  addMedia: (params: {
    activity_id: number;
    file: File;
    media_type: ActivityMediaType;
    caption: string;
    position: number;
    thumbnail: File | null;
  }) => Promise<ActivityMediaRow>,
  onUploaded: (draftId: string, media: ActivityMediaRow) => void,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const nextPosition = existingMedia.reduce((max, item) => Math.max(max, item.position), -1) + 1;
  for (const [index, draft] of drafts.entries()) {
    if (!draft.file) throw new Error(`Etapa ${index + 1} sem arquivo.`);
    onProgress?.(index + 1, drafts.length);
    const media = await addMedia({
      activity_id: activityId,
      file: draft.file,
      media_type: draft.media_type,
      caption: draft.caption,
      position: nextPosition + index,
      thumbnail: draft.media_type === "video" ? draft.thumbnail : null,
    });
    onUploaded(draft.id, media);
  }
}
