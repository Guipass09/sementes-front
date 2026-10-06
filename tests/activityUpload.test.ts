import { test } from "node:test";
import assert from "node:assert/strict";
import { File as NodeFile } from "node:buffer";
import { activityUploadError, MAX_ACTIVITY_UPLOAD_BYTES, uploadActivityDrafts } from "../src/features/activities/activity-upload.ts";
import type { ActivityMediaRow } from "../src/lib/laravel-api.ts";

const file = new NodeFile(["media"], "media.png") as unknown as File;

test("sends mixed slides in order and resumes after an upload failure", async () => {
  const drafts = [
    { id: "image-1", file, thumbnail: null, media_type: "image" as const, caption: "Primeiro" },
    { id: "video", file, thumbnail: file, media_type: "video" as const, caption: "Segundo" },
    { id: "image-2", file, thumbnail: null, media_type: "image" as const, caption: "Terceiro" },
  ];
  const uploaded: ActivityMediaRow[] = [];
  const positions: number[] = [];
  let remaining = [...drafts];
  let failVideo = true;
  const addMedia = async (params: { position: number; media_type: "image" | "video"; caption: string; thumbnail: File | null }) => {
    positions.push(params.position);
    if (params.media_type === "video" && failVideo) throw new Error("Upload interrompido");
    assert.equal(params.thumbnail !== null, params.media_type === "video");
    return { id: positions.length, media_type: params.media_type, url: "/media", position: params.position, caption: params.caption };
  };
  const onUploaded = (draftId: string, media: ActivityMediaRow) => {
    uploaded.push(media);
    remaining = remaining.filter((draft) => draft.id !== draftId);
  };

  await assert.rejects(uploadActivityDrafts(42, remaining, [], addMedia, onUploaded), /Upload interrompido/);
  assert.deepEqual(remaining.map((draft) => draft.id), ["video", "image-2"]);
  failVideo = false;
  await uploadActivityDrafts(42, remaining, uploaded, addMedia, onUploaded);
  assert.deepEqual(uploaded.map((media) => media.position), [0, 1, 2]);
  assert.deepEqual(remaining, []);
  assert.deepEqual(positions, [0, 1, 1, 2]);
});

test("validates video and cover against the request size limit", () => {
  assert.equal(activityUploadError({ size: MAX_ACTIVITY_UPLOAD_BYTES - 10 } as File, "Etapa 1", { size: 11 } as File)?.includes("95 MB"), true);
  assert.equal(activityUploadError({ size: MAX_ACTIVITY_UPLOAD_BYTES - 10 } as File, "Etapa 1", { size: 10 } as File), null);
});
