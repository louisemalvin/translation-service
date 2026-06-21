# Phase 1: Monorepo & Workspace Setup — Planning Handoff

- **User Intent**: Establish the pnpm monorepo workspace with packages/shared (common types) and packages/frontend (Next.js + Tailwind), plus root-level TypeScript and Vitest configuration. This is the foundation all other phases build on.

- **Conversation-Derived Context**: The user wants all 5 phases implemented sequentially from their handoff_plan.md, with git commits between phases. Phase 1 is a single unit — the workspace scaffolding is tightly coupled and must be done atomically. No prior code exists; this creates the initial directory structure.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-1-monorepo.md` — primary spec with exact file contents and structure
  - `docs/monorepo-setup.md` — supplementary monorepo conventions and scripts (note: mentions `packages/edge-functions/` directory but phase-1 spec does not include this; follow phase-1 spec as authoritative)
  - `.ai/context.md` — project conventions (kebab-case, strict TS, named exports, pnpm, vitest)
  - `docs/frontend-spec.md` — UI specs (not directly needed for Phase 1 but defines what frontend will become)

- **Proposed Task Shape**: Single-unit task creating all root + package config files. No runtime logic, no tests to write yet (verification is `pnpm install` + `pnpm test` pass with zero tests). The Next.js app should be scaffolded with `npx create-next-app@latest`.

- **Assigned Output Path(s)**: `.ai/tasks/1718910000-p1-monorepo/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: root package.json, root tsconfig.json, pnpm-workspace.yaml, packages/shared (package.json, tsconfig.json, src/types.ts, src/index.ts), packages/frontend (Next.js + Tailwind scaffold with shared workspace dependency), vitest config
  - OUT OF SCOPE: Any frontend pages/components, Supabase setup, edge functions, ASR/audio code, TTS — those are Phases 2-5

- **Constraints**:
  - pnpm workspace (`packages/*`)
  - TypeScript strict mode, target ES2022, module NodeNext
  - Shared package built via `tsc` → `dist/`
  - Frontend depends on `shared: workspace:*`
  - No tests required yet — just verify the toolchain boots clean
  - Follow kebab-case for files/dirs, camelCase for functions, PascalCase for types/components
  - Named exports preferred over default

- **Acceptance Signals**:
  1. `pnpm install` from root succeeds
  2. `pnpm --filter shared build` generates `dist/` with `.js` + `.d.ts`
  3. `pnpm test` runs with 0 errors (empty suite is acceptable)
  4. `pnpm --filter frontend dev` starts Next.js dev server (do not keep running)

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates all files. Validator confirms acceptance criteria. After validation, orchestrator will trigger a git commit via shipper.

- **Open Questions / Stop Conditions**:
  - None. The phase-1 spec is unambiguous with exact file contents provided.
  - Stop if `pnpm install` fails and cannot be resolved.
