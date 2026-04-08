## Sementes da Fala — Frontend (`sementes-front`)

Frontend web da plataforma **Sementes da Fala**, voltada para terapia com **atividades**, **jogos**, **relatórios**, **sessões** e **transmissão ao vivo** (admin/profissional ↔ paciente).

Este repositório é um app **React + TypeScript** usando **Vite** e **Tailwind**, com UI baseada em **shadcn/ui (Radix UI)**.

---

## Visão geral do produto

O sistema tem 3 perfis principais:

- **Admin** (`/admin`): gerencia usuários/pacientes e profissionais, atividades, jogos, horários e relatórios.
- **Profissional** (`/profissional`): gerencia pacientes, atividades/jogos e acompanha sessões/relatórios.
- **Paciente/Usuário** (`/paciente`): acessa atividades, jogos, relatórios e sessões (conforme permissões).

Além disso, existe a tela de **Sessão ao vivo**:

- **Transmissão**: `GET /sessao/:id/chamada`
  - Mostra a **área de conteúdo** (atividade/jogo via `iframe` ou compartilhamento de tela)
  - E os **vídeos ao vivo** (admin/paciente)
  - Suporta “**dar controle ao paciente**” e sincronização de eventos entre os dois lados.

---

## Stack e bibliotecas

Principais tecnologias (ver `package.json`):

- **React 18** + **TypeScript**
- **Vite 5** (dev server e build)
- **Tailwind CSS** + `tailwindcss-animate`
- **shadcn/ui** / **Radix UI** (componentes acessíveis)
- **React Router DOM** (rotas)
- **TanStack React Query** (cache/estado assíncrono)
- **Axios** (HTTP)
- **OneSignal** (push notifications via web SDK)
- **Embla Carousel** (carrosséis)
- **Recharts** (gráficos)
- **Zod + React Hook Form** (validação/formulários em partes do app)

---

## Como rodar o projeto localmente

### Pré-requisitos

- Node.js (recomendado: LTS)
- npm (ou equivalente)

### Instalar dependências

```bash
npm install
```

### Rodar em desenvolvimento

```bash
npm run dev
```

O Vite está configurado para:

- escutar em `0.0.0.0` (acesso pelo celular na mesma rede)
- usar `strictPort: true` (não “pula” de porta)
- usar polling no watcher (mais robusto no macOS)

Config relevante em `vite.config.ts`.

### Build de produção

```bash
npm run build
```

### Preview do build

```bash
npm run preview
```

---

## Variáveis de ambiente

Arquivo de exemplo: `env.example`.

Principais variáveis (front):

- **`VITE_API_URL`**: URL base do backend (sem `/api` no final)
  - Ex.: `https://api.sementesdafala.com.br`
- **`VITE_MP_PUBLIC_KEY`**: public key do Mercado Pago (uso no frontend)
- **`VITE_ONESIGNAL_APP_ID`**: app id do OneSignal (push)
- **`VITE_PORT`**: porta do Vite (default 5173)
- **`VITE_HMR_HOST`**: host do HMR se precisar expor fora do localhost

---

## Estrutura de pastas (alto nível)

- **`src/App.tsx`**
  - Configura rotas (React Router)
  - Inicializa providers (React Query, tooltips, toasts, Auth, OneSignal, ErrorBoundary)
- **`src/auth/`**
  - `AuthContext.tsx`: login/logout/registro, user no `localStorage`, sync com `/api/me`
  - `RequireRole.tsx`: guards por perfil (`RequireAdmin`, `RequireProfessional`, `RequireUser`)
- **`src/services/api.ts`**
  - Axios client
  - Base URL via `VITE_API_URL`
  - Anexa `Authorization: Bearer <token>` do `localStorage`
- **`src/lib/laravel-api.ts`**
  - Tipos (rows) e funções de API para o backend (Laravel)
  - Inclui endpoints de conteúdo, usuários, jogos, relatórios, sessões e sinalização de vídeo
- **`src/pages/`**
  - Páginas por domínio e perfil (admin/profissional/paciente)
  - Views de jogos (rotas públicas/compartilhadas via `/jogos/...`)
  - `session/SessionCall.tsx`: transmissão ao vivo (WebRTC + sincronização)
- **`src/components/`**
  - Layouts (`AdminLayout`, `PatientLayout`, `ProfessionalLayout`)
  - Componentes de UI e utilidades
- **`src/features/`**
  - Módulos com modais e flows completos (atividades, relatórios, pagamentos, compartilhamentos, etc.)
- **`src/index.css`**
  - Design tokens (CSS variables), helpers de fullscreen/pseudo-fullscreen
  - Ajustes responsivos específicos (ex.: sessão ao vivo em landscape/portrait)

---

## Rotas principais

Definição em `src/App.tsx`.

### Públicas

- `/` (landing)
- `/entrar` (login)
- `/cadastro` (registro)
- `/esqueci-senha`
- `/redefinir-senha`

### Paciente

- `/paciente` (home)
- `/paciente/atividades`
- `/paciente/jogos`
- `/paciente/sessoes`
- `/paciente/relatorios`
- `/paciente/pacotes`

### Profissional

- `/profissional` (dashboard)
- `/profissional/pacientes`
- `/profissional/atividades`
- `/profissional/jogos` (hub)
- `/profissional/horarios`
- `/profissional/relatorios`

### Admin

- `/admin` (dashboard)
- `/admin/usuarios`
- `/admin/atividades`
- `/admin/jogos` (hub)
- `/admin/horarios`
- `/admin/relatorios`

### Sessão ao vivo (transmissão)

- `/sessao/:id/chamada`
- compat: `/sessao/:id` redireciona para `/sessao/:id/chamada`

### Conteúdo (renderizado também dentro da sessão via `iframe`)

- `/atividades/:id`
- `/jogos/memoria/:id`
- `/jogos/memoria2/:id`
- `/jogos/auditivo/:id`
- `/jogos/forca/:id`
- `/jogos/roleta/:id`
- `/jogos/fonema/:id`
- `/jogos/caca-palavras/:id`
- `/jogos/cartas/:id`
- `/jogos/acerte-imagem/:id`

---

## Autenticação, roles e permissões

### Token e usuário

- O token (Bearer) e o usuário são persistidos em `localStorage` (`token` e `user`)
- O app tenta renderizar rápido usando `user` do storage e sincroniza em background via `/api/me`
- Guards ficam em `src/auth/RequireRole.tsx`

### Permissões de acesso (paciente)

Há um modelo de permissões (`access`) com chaves como:

- `atividades`
- `horarios` (controla “Sessões”)
- `relatorios`

O hook `src/hooks/use-access-control.tsx` concentra checagens e bloqueio.

---

## Integração com backend (Laravel)

As chamadas ao backend são centralizadas em:

- `src/services/api.ts` (Axios instance)
- `src/lib/laravel-api.ts` (funções e tipos)

O app espera endpoints no formato típico `.../api/...` (ex.: `/api/login`, `/api/me`), com fallback interno para tentar remover o prefixo `/api` quando necessário.

---

## Sessão ao vivo (transmissão) — como funciona

Arquivo: `src/pages/session/SessionCall.tsx`.

Responsabilidades principais:

- **Entrar na sala** via backend (join) e manter estado mínimo da sessão
- **Sinalização (polling)** via backend para:
  - WebRTC (SDP/ICE)
  - eventos de conteúdo (seleção de atividade/jogo)
  - eventos de controle (dar/retirar controle)
- **WebRTC**:
  - anexar `MediaStream` em `<video>` local/remoto
  - suportar compartilhar tela (quando disponível)
- **Conteúdo da sessão**:
  - renderiza **atividade/jogo** em um `iframe` (com query params `session=1`, `session_role`, etc.)
  - ou renderiza stream de tela (quando screen-share ativo)
- **Controle do paciente**:
  - envia `postMessage` para o `iframe` com `{ type: "SESSION_CONTROL", granted: boolean }`
  - jogos/atividades respeitam esse controle para permitir/impedir interação do usuário

Comunicação com `iframe`:

- o conteúdo (jogo/atividade) emite `postMessage` com `{ type: "SESSION_GAME_EVENT", event }`
- a sessão encaminha para o outro lado via backend (`game_event`)
- ao receber, a sessão repassa ao `iframe` do outro participante

---

## Jogos e atividades (comportamento em sessão)

Quando uma atividade/jogo é aberto dentro da sessão:

- ele recebe query params de sessão (ex.: `session=1`, `session_role=user|admin`, `session_id`)
- ele habilita modo “mais compacto” e/ou pseudo fullscreen em algumas rotas
- ele envia/recebe eventos via `SESSION_GAME_EVENT` para sincronizar estado

Exemplos de componentes/fluxos:

- `src/pages/ActivityView.tsx`: atividade com carrossel, progresso e modal de conclusão
- `src/pages/MemoryGameView.tsx`: memória (com seed para sincronizar shuffle)
- `src/pages/AuditoryGameView.tsx`: arrastar imagem e soltar esquerda/direita (touch/pointer)
- `src/pages/WordSearchGameView.tsx`: caça-palavras (grid + seleção de imagens)
- `src/pages/HangmanGameView.tsx`: forca
- `src/pages/PhonemeGameView.tsx`: discriminação de fonemas
- `src/pages/CardGameView.tsx`: cartas (baralho)
- `src/pages/SpinWheelGameView.tsx`: roleta
- `src/pages/GuessImageGameView.tsx`: acerte a imagem

---

## Notificações (OneSignal)

Hook: `src/hooks/use-onesignal.ts`.

Fluxo:

- carrega o SDK do OneSignal no client
- solicita permissão
- obtém `playerId`
- registra o token no backend via `registerPushToken(...)` (`laravel-api`)

---

## UI/UX e estilos

- Tailwind e tokens de design ficam em `src/index.css`
- Helpers de fullscreen/pseudo fullscreen usam classes como:
  - `fs-target`, `is-pseudo-fullscreen`, `fs-lock`, `fs-mode`
- Componentes shadcn/ui ficam em `src/components/ui/*`
- Ícones: `lucide-react`

---

## Scripts úteis

Ver `package.json`:

- `npm run dev`: inicia Vite
- `npm run dev:clean`: limpa cache do Vite e roda com `--force`
- `npm run build`: build de produção
- `npm run lint`: eslint
- `npm run preview`: preview do build

---

## Dicas de manutenção

- **Mobile/iOS**: inputs `type="date"` podem renderizar com altura diferente — estilos globais ficam em `src/index.css`.
- **Sessão ao vivo**: mudanças no `SessionCall` precisam respeitar regras de hooks (não criar/remover hooks após `return` condicional).
- **Sincronização**: prefira eventos explícitos via `SESSION_GAME_EVENT` para manter admin/paciente consistentes.

---

## Licença / informações adicionais

Este repositório não inclui detalhes de licenciamento. Ajuste este bloco conforme a política do projeto.

