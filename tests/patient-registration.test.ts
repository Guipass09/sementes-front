import assert from "node:assert/strict";
import test from "node:test";
import { registrationLinkUrl, registrationWelcome } from "../src/features/patient-registration/registration.ts";

test("invitation URL uses the current platform origin and explicitly selects the patient registration", () => {
  const url = new URL(registrationLinkUrl("https://www.sementesdafala.com.br/profissional/pacientes", "abc123"));
  assert.equal(url.pathname, "/cadastro");
  assert.equal(url.searchParams.get("perfil"), "paciente");
  assert.equal(url.searchParams.get("convite_profissional"), "abc123");
  assert.equal(new URL(registrationLinkUrl("http://127.0.0.1:5174", "abc123")).origin, "http://127.0.0.1:5174");
});

test("welcome only belongs to the patient account returned by registration", () => {
  const professional = { name: "Marina Exemplo", registration: "CRFa-2 12345", photo_url: null };
  const raw = JSON.stringify({ patient_id: 42, professional });
  assert.deepEqual(registrationWelcome(raw, 42), professional);
  assert.equal(registrationWelcome(raw, 43), null);
});

test("missing malformed or incomplete welcome state cannot display a false success", () => {
  for (const value of [null, "invalid json", "null", "{}", '{"patient_id":42}', '{"patient_id":42,"professional":{"name":""}}']) {
    assert.equal(registrationWelcome(value, 42), null);
  }
  assert.deepEqual(registrationWelcome('{"patient_id":42,"professional":{"name":"Marina"}}', 42), {
    name: "Marina", registration: null, photo_url: null,
  });
});
