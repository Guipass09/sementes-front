import assert from "node:assert/strict";
import test from "node:test";
import {
  letterheadName,
  validateLetterheadLogo,
} from "../src/features/reports/letterhead.ts";

test("letterhead keeps the platform identity unless an author name is configured", () => {
  assert.equal(letterheadName(), "Sementes da Fala");
  assert.equal(letterheadName(null), "Sementes da Fala");
  assert.equal(
    letterheadName({ display_name: "  ", logo_data_url: null }),
    "Sementes da Fala",
  );
  assert.equal(
    letterheadName({ display_name: " Minha Fono ", logo_data_url: null }),
    "Minha Fono",
  );
});

test("logo uploads accept bounded raster images but not SVG or oversized files", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    assert.equal(validateLetterheadLogo({ type, size: 2 * 1024 * 1024 }), null);
  assert.notEqual(
    validateLetterheadLogo({ type: "image/svg+xml", size: 1000 }),
    null,
  );
  assert.notEqual(
    validateLetterheadLogo({ type: "image/png", size: 2 * 1024 * 1024 + 1 }),
    null,
  );
});
