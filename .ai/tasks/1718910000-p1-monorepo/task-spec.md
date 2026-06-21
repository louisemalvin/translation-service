# Task Specification: Phase 1 — Monorepo & Workspace Setup

## Source Artifacts / Handoff Context

| Artifact | Role |
|----------|------|
| `.ai/tasks/1718910000-p1-monorepo/planning-handoff.md` | Canonical planning handoff — scope, constraints, acceptance signals |
| `docs/implementation-plans/phase-1-monorepo.md` | Primary spec with exact file contents and step-by-step instructions |
| `docs/monorepo-setup.md` | Supplementary monorepo conventions (note: `packages/edge-functions/` mentioned but **not** part of Phase 1) |
| `.ai/context.md` | Project conventions: kebab-case files, strict TS, named exports, pnpm, vitest |

**Authoritative source**: `phase-1-monorepo.md` provides exact file contents. The handoff is binding for scope boundaries and acceptance signals. Where `monorepo-setup.md` adds content beyond Phase 1 (e.g., edge-functions, supabase CLI), it is **excluded** from this unit.

---

## Scope

This unit establishes the pnpm monorepo workspace foundation. No prior code exists — all files are created from scratch.

### Files to Create

#### Root-level (3 files)

1. **`pnpm-workspace.yaml`** — defines workspace packages as `packages/*`
2. **`package.json`** — root manifest with scripts (`dev`, `build`, `test`, `test:watch`) and devDependencies (`concurrently`, `typescript`, `vitest`)
3. **`tsconfig.json`** — base TypeScript config: `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `skipLibCheck: true`, `esModuleInterop: true`, `forceConsistentCasingInFileNames: true`

#### `packages/shared/` (4 files)

4. **`packages/shared/package.json`** — name `shared`, main/types pointing to `dist/`, build script `tsc`
5. **`packages/shared/tsconfig.json`** — extends root tsconfig, `outDir: ./dist`, `declaration: true`, includes `src/**/*`
6. **`packages/shared/src/types.ts`** — exports `TranslationPayload` and `TranslationResponse` interfaces (PascalCase)
7. **`packages/shared/src/index.ts`** — barrel file re-exporting all types from `./types` (named exports only)

#### `packages/frontend/` (scaffolded + 1 edit)

8. **`packages/frontend/`** — Next.js TypeScript application scaffolded via:
   ```
   npx create-next-app@latest packages/frontend --typescript --tailwind --eslint --src-dir --app --import-alias "@/*" --use-pnpm
   ```
   After scaffolding, edit `packages/frontend/package.json` to add `"shared": "workspace:*"` to `dependencies`.

### Exact File Contents

The implementer must produce files matching the exact content from `docs/implementation-plans/phase-1-monorepo.md`, specifically:

**`pnpm-workspace.yaml`**:
```yaml
packages:
  - 'packages/*'
```

**Root `package.json`** (exact from phase-1 spec):
```json
{
  "name": "translation-pipeline",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter frontend dev\" \"supabase start\"",
    "build": "pnpm --filter shared build && pnpm --filter frontend build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "typescript": "^5.2.2",
    "vitest": "^1.0.0"
  }
}
```

**Root `tsconfig.json`** (exact from phase-1 spec):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

**`packages/shared/package.json`** (exact from phase-1 spec):
```json
{
  "name": "shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.2.2"
  }
}
```

**`packages/shared/tsconfig.json`** (exact from phase-1 spec):
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

**`packages/shared/src/types.ts`** (exact from phase-1 spec):
```typescript
export interface TranslationPayload {
  sequenceNumber: number;
  rawText: string;
  translatedText: string;
  timestamp: number;
}

export interface TranslationResponse {
  translated_text: string;
}
```

**`packages/shared/src/index.ts`** (barrel — not provided verbatim in phase-1 spec but implied by "Export types"):
```typescript
export type { TranslationPayload, TranslationResponse } from './types';
```

Convention check: PascalCase types, named exports only, no default export. ✅

### Conventions (from `.ai/context.md`)

- **File/directory names**: `kebab-case` (e.g., `packages/frontend/`, `monorepo-setup.md`)
- **Type/interface names**: `PascalCase` (e.g., `TranslationPayload`)
- **Function/variable names**: `camelCase`
- **Exports**: named exports preferred over default
- **TypeScript**: strict mode, no unused variables/imports
- **Test files**: `*.test.ts`, co-located with source

---

## Execution

### Pipeline

```
implementer → validator
```

### Implementer Steps

1. **Create directory structure**:
   - `packages/shared/src/`
   - `packages/frontend/` (will be populated by create-next-app)

2. **Create root config files** (exact contents from Scope section above):
   - `pnpm-workspace.yaml`
   - `package.json`
   - `tsconfig.json`

3. **Create shared package files** (exact contents from Scope section above):
   - `packages/shared/package.json`
   - `packages/shared/tsconfig.json`
   - `packages/shared/src/types.ts`
   - `packages/shared/src/index.ts`

4. **Scaffold frontend**:
   - Run: `npx create-next-app@latest packages/frontend --typescript --tailwind --eslint --src-dir --app --import-alias "@/*" --use-pnpm`
   - Edit `packages/frontend/package.json`: add `"shared": "workspace:*"` to `dependencies`

5. **Install dependencies**:
   - Run: `pnpm install` from workspace root

6. **Build shared package**:
   - Run: `pnpm --filter shared build`
   - Verify `packages/shared/dist/` exists with `.js` and `.d.ts` files

7. **Run vitest**:
   - Run: `pnpm test`
   - Expected: vitest boots, finds no test files, exits with code 0

8. **Verify frontend dev server**:
   - Run: `pnpm --filter frontend dev`
   - Confirm Next.js dev server starts on the default port
   - Stop the dev server (Ctrl+C) — do not leave running

### Validator Steps

The validator must independently confirm all **Testable Acceptance Criteria** below without relying on implementer state. Re-run commands fresh where specified.

---

## Non-Goals

Explicitly **out of scope** for this unit:

- Any frontend pages, components, or custom styling (Phases 4–5)
- Supabase project initialization, migrations, or config (Phase 2)
- Edge Functions or Deno runtime code (Phase 3)
- ASR / Web Speech API integration (Phase 4)
- TTS integration (Phase 5)
- Any test files (`.test.ts`) — zero tests is acceptable; the toolchain just needs to boot cleanly
- The `packages/edge-functions/` directory mentioned in `monorepo-setup.md` — Phase 1 does not create it
- The `supabase/` directory
- Vitest configuration file — vitest runs with its defaults (looks for `*.test.ts`); no config file is needed at this stage
- `packages/shared/src/utils.ts` or `utils.test.ts` — these are Phase 2+

---

## Testable Acceptance Criteria

### TAC-1: `pnpm install` succeeds from workspace root

- **Command**: `pnpm install`
- **Expected**: exit code 0, all dependencies resolved, `node_modules/` populated, workspace symlinks for `shared → frontend` created
- **Stop condition**: If this fails, halt and report the error. Do not proceed to subsequent steps.

### TAC-2: `pnpm --filter shared build` generates dist/

- **Command**: `pnpm --filter shared build`
- **Expected**: exit code 0, `packages/shared/dist/` directory exists containing:
  - `index.js` (compiled JavaScript)
  - `index.d.ts` (type declarations)
  - `types.js`
  - `types.d.ts`
- **Check**: `packages/shared/dist/index.d.ts` should export `TranslationPayload` and `TranslationResponse`

### TAC-3: `pnpm test` runs with zero errors

- **Command**: `pnpm test`
- **Expected**: vitest boots, finds 0 test files, exits with code 0
- **No test files exist** — this is acceptable and expected for Phase 1

### TAC-4: `pnpm --filter frontend dev` starts Next.js dev server

- **Command**: `pnpm --filter frontend dev` (run briefly, then stop)
- **Expected**: Next.js dev server starts, outputs the localhost URL, no fatal errors
- **Note**: Stop the server after confirming successful start. Do not leave it running.

### Test File Paths

No test files are created in this phase. The acceptance criteria are verified via CLI commands at the workspace root.

---

## Inspectable Acceptance Criteria

### IAC-1: File structure matches spec

Verify the following paths exist with correct content:

```
pnpm-workspace.yaml          (content matches Scope section exactly)
package.json                 (content matches Scope section exactly)
tsconfig.json                (content matches Scope section exactly)
packages/shared/package.json (content matches Scope section exactly)
packages/shared/tsconfig.json(content matches Scope section exactly)
packages/shared/src/types.ts (content matches Scope section exactly)
packages/shared/src/index.ts (named re-exports of both types)
packages/frontend/           (Next.js scaffold directory exists)
packages/frontend/package.json (contains "shared": "workspace:*" in dependencies)
```

### IAC-2: Conventions compliance

- All files use `kebab-case` naming ✅
- `TranslationPayload` and `TranslationResponse` use `PascalCase` ✅
- `packages/shared/src/index.ts` uses **named** exports (`export type { ... }`), not default exports ✅
- Root `tsconfig.json` has `"strict": true` ✅

### IAC-3: Workspace dependency linkage

- `packages/frontend/package.json` must contain:
  ```json
  "dependencies": {
    "shared": "workspace:*"
  }
  ```
- Running `node -e "require('shared')"` from `packages/frontend/` after `pnpm --filter shared build` should resolve the shared package (via pnpm workspace symlink)

---

## Relevant Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Root workspace definition |
| `package.json` | Root scripts and devDependencies |
| `tsconfig.json` | Base TypeScript compiler options |
| `packages/shared/package.json` | Shared package manifest |
| `packages/shared/tsconfig.json` | Shared package TS config (extends root) |
| `packages/shared/src/types.ts` | `TranslationPayload` and `TranslationResponse` interfaces |
| `packages/shared/src/index.ts` | Barrel re-exports of types |
| `packages/frontend/package.json` | Frontend manifest (post-scaffold, with shared dep) |

---

## Validation Plan

The validator executes this checklist independently:

1. **Clean environment check**: Confirm no stale `node_modules/` or lockfiles interfere.
2. **TAC-1**: Run `pnpm install` → expect exit 0.
3. **IAC-1**: Diff each created file against expected contents from the Scope section.
4. **TAC-2**: Run `pnpm --filter shared build` → expect `dist/` with `.js` + `.d.ts`.
5. **TAC-3**: Run `pnpm test` → expect vitest exits 0 with 0 test files.
6. **IAC-2**: Spot-check naming conventions (kebab-case files, PascalCase types, named exports).
7. **IAC-3**: Verify `shared: workspace:*` dependency in frontend `package.json`.
8. **TAC-4**: Run `pnpm --filter frontend dev` → confirm dev server starts, then stop it.

If all pass, the unit is complete. Report results to the orchestrator.

---

## Open Questions

None. The phase-1 specification is unambiguous with exact file contents provided. The handoff, `phase-1-monorepo.md`, `monorepo-setup.md`, and `.ai/context.md` together provide complete coverage of scope, constraints, and acceptance criteria.

**Stop condition**: If `pnpm install` fails at TAC-1 and cannot be resolved, halt and report the error. Do not proceed.
