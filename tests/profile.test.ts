import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE_PHOTO_LIMIT, profileInitials, profilePhotoError, profileRegistration, profileTextErrors } from "../src/features/profile/profile.ts";

test("registration uses existing credentials without inventing or changing their formatting", () => {
  assert.equal(profileRegistration({ professional_crfa: " CRFa-2 12345 ", professional_registration: "other" }), "CRFa-2 12345");
  assert.equal(profileRegistration({ professional_crfa: " ", professional_registration: "2 19953" }), "2 19953");
  assert.equal(profileRegistration({}), null);
});

test("avatar initials handle blanks, spacing and unicode names", () => {
  assert.equal(profileInitials("  Marina   Oliveira Exemplo "), "MO");
  assert.equal(profileInitials(""), "");
  assert.equal(profileInitials("Ágata Érica"), "ÁÉ");
});

test("text validation matches profile limits and ignores surrounding name whitespace", () => {
  assert.deepEqual(profileTextErrors(" Marina ", ""), {});
  assert.ok(profileTextErrors("   ", "").name);
  assert.ok(profileTextErrors("aa", "").name);
  assert.ok(profileTextErrors("a".repeat(256), "").name);
  assert.ok(profileTextErrors("Marina", "a".repeat(5001)).description);
  assert.deepEqual(profileTextErrors("a".repeat(255), "a".repeat(5000)), {});
});

test("photo validation rejects unsupported files and oversize or empty uploads", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    assert.equal(profilePhotoError({ type, size: PROFILE_PHOTO_LIMIT }), null);
  }
  assert.ok(profilePhotoError({ type: "image/png", size: PROFILE_PHOTO_LIMIT + 1 }));
  assert.ok(profilePhotoError({ type: "image/png", size: 0 }));
  assert.ok(profilePhotoError({ type: "image/svg+xml", size: 100 }));
});
