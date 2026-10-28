# Cadastro e contratação individual

Fluxo: landing com plano selecionado → cadastro profissional → `/profissional/assinatura` → checkout Kiwify em nova aba → retorno/verificação → acesso após confirmação do backend.

A página mantém a decisão dentro da conta, mostra o valor devido e a próxima renovação, preserva o plano selecionado e permite voltar ao pagamento sem repetir o cadastro. Contas inativas visualizam Assinatura e Perfil; páginas operacionais permanecem bloqueadas. Clínicas e acesso legado seguem suas regras anteriores. Contas ativas não recebem novos CTAs de compra.

Os planos e os três links são centralizados em `src/features/subscription/plans.ts`. A oferta de boas-vindas aparece para contas sem período e sem histórico. Um clique em checkout nunca altera autorização. A assinatura é consultada a cada 15 segundos enquanto a conta aguarda ativação e pode ser verificada manualmente; a atualização de acesso vem de `/api/me`.

O backend Kiwify precisa ser implantado e o webhook cadastrado no painel do vendedor para liberação automática. Consulte `docs/KIWIFY_WEBHOOK.md` no repositório backend. Sem o cadastro externo, continuam funcionando a contratação por link e o controle manual existente, mas não há confirmação automática da compra.

Referências pesquisadas em 28/10/2026:

- Notion: Settings → Explore/Upgrade plans → resumo da cobrança → checkout: https://www.notion.com/help/upgrade-or-downgrade-your-plan
- Slack: comparação de planos → Upgrade now → revisão da compra → pagamento: https://slack.com/help/articles/218915077-Upgrade-your-free-workspace-to-a-paid-subscription
- Kiwify: checkout a partir da área autenticada, preservando acesso à conta: https://ajuda.kiwify.com.br/pt-br/article/como-vender-meus-cursos-pela-area-de-membros-kiwify-etctxv/
- Confirmação externa por webhook: https://docs.kiwify.com.br/api-reference/webhooks/receiving

As referências orientam a navegação e a transparência da cobrança; não se trata de copiar identidade visual ou oferecer um período gratuito inexistente.

Validação automatizada sem cobranças reais: `node --experimental-strip-types --test tests/subscription-plans.test.ts tests/subscription-details.test.ts tests/subscriptionStatus.test.ts` e `node tests/subscription-checkout.e2e.mjs` (Playwright/Chrome, com API e checkout simulados).
