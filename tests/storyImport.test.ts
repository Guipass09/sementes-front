import assert from "node:assert/strict";
import test from "node:test";
import { activitySlides } from "../src/features/stories/story-import.ts";

test("slide import orders images, GIFs and videos without mutating the source", () => {
  const media = [
    { id: 8, position: 2, media_type: "image" as const, url: "last.gif" },
    { id: 9, position: 1, media_type: "video" as const, url: "middle.mp4" },
    { id: 5, position: 0, media_type: "image" as const, url: "first.png" },
  ];
  assert.deepEqual(activitySlides({ media }).map(slide => slide.id), [5, 9, 8]);
  assert.deepEqual(media.map(slide => slide.id), [8, 9, 5]);
  assert.deepEqual(activitySlides({ is_story: true, media }), []);
  assert.deepEqual(activitySlides({ media: [] }), []);
});
