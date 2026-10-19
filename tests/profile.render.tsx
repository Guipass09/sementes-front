import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { ProfileEditor } from "../src/pages/Profile";
import type { AuthUser } from "../src/lib/laravel-api";

const user: AuthUser = { id: 10, name: "Marina Exemplo", email: "marina@example.test", role: "professional",
  blocked: false, professional_crfa: "CRFa-2 12345", professional_share_id: "SF-A1B2-C3D4-E5F6", access: { atividades: true, horarios: true, relatorios: true } };
const render = (value: AuthUser) => renderToStaticMarkup(<TooltipProvider><ProfileEditor user={value} onSaved={() => {}} /></TooltipProvider>);

test("professional profile includes editable identity fields and a read-only registration", () => {
  const markup = render(user);
  assert.ok(markup.includes("Meu perfil"));
  assert.ok(markup.includes('id="profile-name"'));
  assert.ok(markup.includes('id="profile-description"'));
  assert.match(markup, /<input[^>]*id="profile-registration"[^>]*readonly=""[^>]*aria-readonly="true"/);
  assert.ok(markup.includes("CRFa-2 12345"));
  assert.ok(markup.includes("SF-A1B2-C3D4-E5F6"));
  assert.ok(markup.includes('aria-label="Copiar ID de compartilhamento"'));
  assert.ok(markup.includes("Salvar alterações"));
  assert.ok(markup.includes("Descartar"));
  assert.ok(!markup.includes('role="dialog"'));
});

test("patient and admin pages do not display professional registration fields", () => {
  for (const role of ["user", "admin"] as const) {
    const markup = render({ ...user, role });
    assert.ok(!markup.includes('id="profile-registration"'));
    assert.ok(markup.includes('id="profile-name"'));
  }
});
