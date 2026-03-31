# CashTrack

Aplicacao web de controle financeiro pessoal com frontend em React + Vite e backend em Node.js + Express.

## Visao Geral

O projeto permite:

- Cadastro e login de usuarios.
- Registro de receitas e despesas.
- Organizacao por categorias (base e personalizadas).
- Dashboard com saldo, distribuicao de gastos e indicadores.
- Relatorios por periodo (`ALL`, `Q1`, `Q2`, `Q3`, `Q4`) e ano.
- Gestao de perfil (dados pessoais, preferencias, senha).
- Exportacao dos dados do usuario em JSON.

## Arquitetura

- `frontend/`: interface SPA em React + TypeScript.
- `backend/`: API REST com autenticacao via JWT (cookie `httpOnly` e suporte a `Bearer`).
- `backend/data/db.json`: armazenamento local em arquivo JSON (sem banco SQL).
- `docker-compose.yml`: orquestracao dos servicos de desenvolvimento.

### Stack

- Frontend: React 19, TypeScript, Vite 8, TailwindCSS 4 (plugin Vite), CSS custom.
- Backend: Node.js (ESM), Express 4, Zod, JWT, bcrypt, CORS, Helmet, Morgan.
- Containers: Docker + Docker Compose.

## Requisitos

- Node.js 22+ (recomendado, mesma base dos Dockerfiles).
- npm 10+.
- Docker e Docker Compose (opcional).

## Estrutura Principal

```text
appfin/
  backend/
    src/
      server.js
      auth.js
      db.js
      utils.js
    data/
      db.json
    .env.example
    Dockerfile
  frontend/
    src/
      App.tsx
      main.tsx
      icons/categoryIcons.ts
    public/
    Dockerfile
  docker-compose.yml
```

## Como Rodar (Local, sem Docker)

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend padrao: `http://localhost:3333`

### 2) Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend padrao do Vite: `http://localhost:5173`  
No `docker-compose`, o frontend e exposto em `http://localhost:5174`.

## Variaveis de Ambiente

### Backend (`backend/.env`)

Baseado em `backend/.env.example`:

```env
PORT=3333
JWT_SECRET=troque-por-um-segredo-forte-com-16-ou-mais-caracteres
FRONTEND_ORIGIN=http://localhost:5174
```

- `PORT`: porta da API.
- `JWT_SECRET`: obrigatorio e com no minimo 16 caracteres (o backend falha ao iniciar se for fraco/ausente).
- `FRONTEND_ORIGIN`: origem autorizada no CORS.

### Frontend

O frontend usa `VITE_API_URL` e, se nao informado, assume `http://localhost:3333`.

Exemplo (`frontend/.env.local`):

```env
VITE_API_URL=http://localhost:3333
```

Internamente, o app garante sufixo `/api`.

## Como Rodar com Docker Compose

Na raiz do projeto:

```bash
docker compose up --build
```

Servicos:

- Frontend: `http://localhost:5174` (container `cashtrack-frontend`)
- Backend: `http://localhost:3333` (container `cashtrack-backend`)

Observacoes:

- O compose monta volumes para hot reload em `frontend/` e `backend/`.
- O frontend recebe `VITE_API_URL=http://localhost:3333`.
- O backend recebe `PORT`, `JWT_SECRET` e `FRONTEND_ORIGIN=http://localhost:5174`.

## Scripts Disponiveis

### Backend (`backend/package.json`)

- `npm run dev`: inicia com `node --watch`.
- `npm start`: inicia em modo normal.

### Frontend (`frontend/package.json`)

- `npm run dev`: servidor Vite.
- `npm run build`: TypeScript build + bundle.
- `npm run preview`: preview do build.
- `npm run lint`: ESLint.

## Modelo de Dados (JSON)

Arquivo: `backend/data/db.json`

- `users[]`
  - `id`, `email`, `passwordHash`, `displayName`, `plan`, `monthlyIncome`, `targetSave`, `notifyLimit`, `weeklySummary`, `goal`, `createdAt`
- `categories[]`
  - `id`, `userId`, `name`, `type` (`income|expense`), `icon`, `predefined`, `createdAt`
- `transactions[]`
  - `id`, `userId`, `type`, `amount`, `description`, `categoryId`, `date` (`YYYY-MM-DD`), `account`, `recurrence`, `note`, `createdAt`

## Regras Importantes de Negocio

- Novos usuarios recebem categorias base automaticamente.
- Categorias `predefined` nao podem ser editadas nem removidas.
- Validacao de payloads feita com Zod.
- Datas de transacao devem estar em formato ISO (`YYYY-MM-DD`) valido.
- Rate limit em memoria:
  - Autenticacao: 30 req / 15 min por IP.
  - Escrita: 90 req / minuto por IP.
- Sessao:
  - JWT com expiracao de 7 dias.
  - Cookie `cashtrack_session` (`httpOnly`, `sameSite=lax`, `secure` apenas em producao).

## API REST

Base URL: `http://localhost:3333/api`

### Publicas

- `GET /health` - status da API.
- `POST /auth/register` - cadastro.
- `POST /auth/login` - login.
- `POST /auth/logout` - encerra sessao (limpa cookie).

### Autenticadas

- `GET /me` - dados do usuario atual.
- `PUT /me/profile` - atualiza perfil.
- `PUT /me/password` - troca senha.
- `GET /me/export` - exporta dados do usuario.
- `DELETE /me` - exclui conta e dados.
- `GET /categories` - lista categorias do usuario.
- `POST /categories` - cria categoria.
- `PUT /categories/:id` - edita categoria personalizada.
- `DELETE /categories/:id` - remove categoria personalizada.
- `GET /transactions` - lista transacoes.
- `POST /transactions` - cria transacao.
- `PUT /transactions/:id` - edita transacao.
- `DELETE /transactions/:id` - remove transacao.
- `GET /dashboard/summary?month=YYYY-MM` - resumo mensal opcional.
- `GET /reports/overview?year=YYYY&period=ALL|Q1|Q2|Q3|Q4` - resumo de relatorio.

### Exemplo rapido de autenticacao (login)

```bash
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"123456"}'
```

## Frontend: Fluxo Funcional

Arquivo principal: `frontend/src/App.tsx`

O frontend esta concentrado em um componente unico (estado global local) com estagios:

- `welcome`: landing inicial.
- `onboarding`: configuracao inicial apos cadastro.
- `app`: aplicacao principal.

Paginas internas:

- `dashboard`
- `transactions`
- `add`
- `categories`
- `reports`
- `profile`

A comunicacao com o backend e feita por `apiRequest()`, sempre com `credentials: 'include'`, usando cookie de sessao ou `Bearer` quando aplicavel.

## Qualidade e Linters

- Frontend possui ESLint configurado em `frontend/eslint.config.js`.
- Nao ha suite de testes automatizados dedicada ao app `cashtrack` neste repositorio.

## Limitacoes Atuais

- Persistencia em arquivo JSON local (nao indicado para producao em escala).
- Rate limiter em memoria (reinicia ao reiniciar o processo).
- Nao ha refresh token nem revogacao centralizada de JWT.
- Grande parte da logica de UI esta em um unico arquivo (`App.tsx`), com acoplamento alto.

## Melhorias Recomendadas

- Migrar persistencia para Postgres/MySQL + ORM.
- Separar frontend em componentes, hooks e camada de servicos.
- Adicionar testes (unitarios/integracao/e2e).
- Implementar observabilidade (logs estruturados + metricas).
- Endurecer seguranca para ambiente de producao (secret manager, rotacao de chaves, proxy reverso, HTTPS obrigatorio).

## Nota sobre Pastas Extras

A pasta `ia_skills/` existe no workspace, mas nao faz parte da execucao direta do app `cashtrack` (frontend/backend) descrito neste README.

