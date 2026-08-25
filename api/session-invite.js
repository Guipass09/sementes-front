const SITE_URL = "https://www.sementesdafala.com.br";
const IMAGE_URL = `${SITE_URL}/orientacao-conexao-sementes-da-fala-preview.jpg`;
const DESCRIPTION =
  "Para entrar no atendimento, clique no link e depois em participar, caso peça para autorizar camera ou microfone é necessario permitir 💚";

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function handler(req, res) {
  const id = String(first(req.query.id) || "").replace(/\D/g, "");
  const inviteToken = String(first(req.query.invite_token || req.query.invite || req.query.token) || "").trim();

  const target = new URL(id ? `/sessao/${id}/chamada` : "/", SITE_URL);
  if (inviteToken) target.searchParams.set("invite_token", inviteToken);

  const targetUrl = target.toString();
  const title = "Sementes da Fala - Atendimento ao vivo";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  res.end(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(DESCRIPTION)}" />
    <link rel="canonical" href="${escapeHtml(targetUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(DESCRIPTION)}" />
    <meta property="og:url" content="${escapeHtml(targetUrl)}" />
    <meta property="og:image" content="${escapeHtml(IMAGE_URL)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(IMAGE_URL)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(DESCRIPTION)}" />
    <meta name="twitter:image" content="${escapeHtml(IMAGE_URL)}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}" />
    <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
  </head>
  <body>
    <p>Redirecionando para o atendimento...</p>
    <p><a href="${escapeHtml(targetUrl)}">Entrar no atendimento</a></p>
  </body>
</html>`);
};
