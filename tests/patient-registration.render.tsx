import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "../src/components/ui/dialog";
import { RegistrationWelcomeContent } from "../src/features/patient-registration/RegistrationWelcomeDialog";

test("success dialog identifies the linked professional and registration with a clear next action", () => {
  const markup = renderToStaticMarkup(<Dialog open><RegistrationWelcomeContent professional={{
    name: "Marina Exemplo", registration: "CRFa-2 12345", photo_url: "/storage/marina.png",
  }} onContinue={() => {}} /></Dialog>);
  assert.ok(markup.includes("Cadastro concluído"));
  assert.ok(markup.includes("Marina Exemplo"));
  assert.ok(markup.includes("CRFa-2 12345"));
  assert.ok(markup.includes("vinculado ao profissional"));
  assert.ok(markup.includes("Acessar meu espaço"));
  assert.ok(markup.includes("lucide-badge-check"));
});

test("missing professional photo or registration is never replaced with invented credentials", () => {
  const markup = renderToStaticMarkup(<Dialog open><RegistrationWelcomeContent professional={{
    name: "Marina & Equipe", registration: null, photo_url: null,
  }} onContinue={() => {}} /></Dialog>);
  assert.ok(markup.includes("Marina &amp; Equipe"));
  assert.ok(markup.includes("lucide-user-round"));
  assert.ok(!markup.includes("CRFa"));
  assert.ok(!markup.includes("<img"));
});
