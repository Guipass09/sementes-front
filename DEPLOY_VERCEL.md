## Deploy no Vercel + Backend Laravel (Sanctum)

Se o frontend estiver em **HTTPS** (Vercel), o backend **precisa** estar em **HTTPS** também.
Caso contrário, o navegador bloqueia as requests (erro **Mixed Content**) e o fluxo de cookies/CSRF do Sanctum não funciona.

### 1) Config do Vercel (Frontend)

Crie a variável de ambiente no Vercel:

- **`VITE_API_URL`**: URL base do backend **em HTTPS** (sem barra no final)

Exemplos:

- `VITE_API_URL=https://api.sementesdafala.com`
- `VITE_API_URL=https://<seu-alb-ou-domínio>`

Depois **redeploy** no Vercel.

### 2) Checklist do Backend (Laravel + Sanctum)

No Laravel:

- **CORS** com credenciais:
  - `supports_credentials=true`
  - `allowed_origins` contendo `https://sementesdafala.vercel.app` (ou seu domínio)
- **Sanctum**:
  - `SANCTUM_STATEFUL_DOMAINS=sementesdafala.vercel.app`
- **Cookies cross-site (se front/back são domínios diferentes)**:
  - `SESSION_SECURE_COOKIE=true`
  - `SESSION_SAME_SITE=none`

### 3) Fluxo correto (SPA)

- GET `/sanctum/csrf-cookie`
- POST `/login` (ou seu endpoint `/api/login`), com cookies habilitados



