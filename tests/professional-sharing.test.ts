import assert from "node:assert/strict";
import test from "node:test";
import { normalizedSharingId, shareRecipientPayload } from "../src/features/sharing/professional-share.ts";

test("copied and pasted professional IDs normalize without changing identity", () => {
  for (const id of ["SF-A1B2-C3D4-E5F6", " sf-a1b2-c3d4-e5f6 \n", "SFA1B2C3D4E5F6", "SF A1B2 C3D4 E5F6"]) {
    assert.equal(normalizedSharingId(id), "SF-A1B2-C3D4-E5F6");
  }
});

test("names, email addresses and truncated or malicious input never resolve locally as IDs", () => {
  for (const value of ["", "Marina", "marina@example.test", "123", "SF-A1B2", "SF-A1B2-C3D4-G5F6", "SF-A1B2-C3D4-E5F6<script>"]) {
    assert.equal(normalizedSharingId(value), null);
  }
});

test("sharing a public ID never submits a professional directory or modifies existing recipients", () => {
  assert.deepEqual(shareRecipientPayload("SF-A1B2-C3D4-E5F6"), { professional_share_id: "SF-A1B2-C3D4-E5F6" });
  assert.deepEqual(shareRecipientPayload([1, 2]), { professional_ids: [1, 2] });
});
