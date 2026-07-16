# Yunora AI

AI-powered educational question generation admin panel for managing curriculum hierarchies and generating high-quality exam questions at scale.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/yunora-admin run dev` — run the admin frontend (port 25736, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Zustand, Recharts, Wouter, React Query
- API: Express 5, JWT auth (jsonwebtoken + bcryptjs)
- DB: PostgreSQL + Drizzle ORM
- AI: GitHub Models API (multi-agent pipeline via setImmediate async jobs)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Source-of-truth OpenAPI spec
- `lib/db/src/schema/index.ts` — Drizzle DB schema (all tables)
- `lib/api-client-react/src/` — Generated React Query hooks + custom-fetch
- `artifacts/api-server/src/routes/` — All backend route handlers
- `artifacts/yunora-admin/src/` — React frontend (pages, hooks, components)

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks used everywhere in frontend
- **JWT auth**: Token stored in Zustand (persisted via localStorage key `yunora_token`); `setAuthTokenGetter` in custom-fetch injects it as Bearer header
- **Async AI jobs**: `setImmediate` simulates async job queuing (no Redis/BullMQ required); status polled via GET `/api/generation/:id`
- **5-agent AI pipeline**: Planner → Generator → Validator → Explainer → Ranker — each agent is a sequential GitHub Models API call within one job
- **Path-based proxy routing**: All traffic through shared proxy; API at `/api`, frontend at `/`

## Product

- **Hierarchy management**: Boards → Standards → Subjects → Chapters → Topics (full CRUD with tree navigation)
- **AI Question Generation**: Configure topic, question type, difficulty, count; AI pipeline generates + validates + ranks questions automatically
- **Question Bank**: Browse all generated questions with filtering, search, bulk export
- **Generation Jobs**: Monitor async AI job status in real-time
- **AI Providers**: Manage GitHub Models API keys and model selection per provider
- **Papers**: Assemble curated question sets into exam papers
- **Analytics**: Charts for generation volume, question distribution, success rates

## Default Admin

- Email: `admin@yunora.ai`
- Password: `admin123`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec changes before touching frontend
- Run `pnpm --filter @workspace/db run push` after schema changes in `lib/db/src/schema/`
- The `bcryptjs` hash for seeding must be generated via the api-server's node (e.g., `node -e "require('./node_modules/bcryptjs').hash(...)"`)
- AI generation requires a valid GitHub Models API key set on an AI Provider record in the DB

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
