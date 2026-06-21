# agy Handoff — Phase 4A: PWA Configuration

## Implementer Persona and Boundaries

You are the Implementer Agent.

Own implementation only after the task is specified and approved in `.ai/tasks/<NNN>-<task-id>/task-spec.md`. You are a custom implementation subagent used by orchestrator.

Responsibilities:
- Read `.ai/context.md` (use the `read` tool — `glob` is unreliable for `.ai/` paths) and the task spec before editing.
- Read the files listed in the task spec's `## Relevant Files` section. If those files import or reference other files you need to understand, read those too — but only as far as needed. Do not explore unrelated parts of the codebase.
- Make the smallest correct change that satisfies the task spec.
- Preserve unrelated user changes.
- Run the smallest relevant verification when practical.
- Write `.ai/tasks/<NNN>-<task-id>/implementation-report.md` with sections: Outcome, Files Changed, Decisions, Verification. Include Known Issues only if there are any.
- Run the project's test suite (using the test runner from `.ai/context.md` — read it with the `read` tool, as `glob` is unreliable for `.ai/` paths). Confirm that the task-specific tests pass. If pre-existing baseline tests fail, note them as Known Issues but do not chase them.

Boundaries:
- Do not edit `.ai/tasks/**` except the task's `implementation-report.md`.
- Do not edit `.ai/context.md` or `.ai/decisions/**`.
- Do not add backward compatibility, dependencies, abstractions, new files, or broad rewrites unless the task spec requires them.
- Do not commit, amend, or push.
- Do not write test files — the test-writer agent owns tests. Only write implementation source code.
- Do not modify the agy configuration or toggle. The `agy: enabled` flag in `.ai/context.md` is user-owned.

If requirements are unclear, destructive, security-sensitive, or conflict with the task spec, stop and report back to orchestrator.

Default report back:
- Changes made.
- Implementation report path.
- Verification run.
- Open issues, risks, or follow-up needed.
- Test results — pass/fail counts and any failures.

## Orchestrator Command

Implement Phase 4A: PWA Configuration. Create/update the following files:
1. `packages/frontend/public/manifest.json` — PWA manifest
2. `packages/frontend/public/sw.js` — Minimal service worker
3. `packages/frontend/src/app/layout.tsx` — Add PWA metadata

After implementation, write the implementation report to: `.ai/tasks/1718913000-p4a-pwa/implementation-report.md`

Do NOT run the validator.

## Task Spec

Path: `.ai/tasks/1718913000-p4a-pwa/task-spec.md`

Full contents:

### Phase 4A: PWA Configuration — Task Specification

#### Source Artifacts / Handoff Context
- **Planning Handoff**: `.ai/tasks/1718913000-p4a-pwa/planning-handoff.md` — defines scope, constraints, acceptance signals, and non-goals.
- **Phase 4 Implementation Plan**: `docs/implementation-plans/phase-4-speaker-pwa.md` Step 1 — PWA manifest and service worker instructions.
- **Frontend Spec**: `docs/frontend-spec.md` Section "PWA Keep-Alive & Wake Lock" — wake lock code (out of scope for 4A, belongs to 4C) but confirms PWA conventions and the `Screen Wake Lock API` usage.
- **Existing Codebase**: `packages/frontend/` Next.js 16 App Router scaffold from Phase 1. Current `layout.tsx` uses `metadata` export, `<html>` with Tailwind classes.

#### Scope
This is a single-unit task to configure the Next.js frontend as an installable Progressive Web App for the speaker's mobile device. It has no dependencies on other Phase 4 units (4B–4E).

**Deliverables:**

1. **`packages/frontend/public/manifest.json`** — Web App Manifest
   - `"name": "Sermon Translator"`
   - `"short_name": "Sermons"`
   - `"description": "Real-time sermon translation console"`
   - `"start_url": "/speaker"`
   - `"display": "standalone"`
   - `"orientation": "portrait"`
   - `"theme_color": "#0f172a"`
   - `"background_color": "#020617"`
   - `"icons"` array with placeholder entries (512x512 and 192x192 — note in comments that actual icon assets will be added later, use `"src": "/icon-192.png"` and `"src": "/icon-512.png"` pointing to placeholder paths)
   - Valid JSON (no syntax errors, all required fields present)

2. **`packages/frontend/public/sw.js`** — Minimal Service Worker
   - `self.addEventListener('install', ...)` — log install success, call `skipWaiting()` to activate immediately
   - `self.addEventListener('activate', ...)` — log activation, call `clients.claim()` to take control of open pages
   - No `fetch` listener, no caching strategy (caching is out of scope)
   - Plain JavaScript (no build step needed for this file)

3. **`packages/frontend/src/app/layout.tsx`** — Updated Root Layout
   - Update the Next.js `metadata` export to include:
     - `manifest: "/manifest.json"` — link to the web app manifest
     - `appleWebApp: { capable: true, title: "Sermon Translator", statusBarStyle: "black-translucent" }`
     - `themeColor: "#0f172a"`
   - Add a Next.js `viewport` export: `viewport: Viewport = { themeColor: "#0f172a", width: "device-width", initialScale: 1 }`
   - Add a `<script>` tag at the end of `<body>` (after `{children}`) that registers the service worker:
     ```html
     <script>{`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}</script>
     ```
   - Do NOT remove or alter existing font/className/Tailwind setup. The existing `<html>` attributes and `<body>` className must be preserved.

#### Implementation Notes
- The `manifest.json` must be served from the Next.js `public/` directory, which maps to the root URL path (`/manifest.json`).
- The `sw.js` must also be in `public/` to be served at `/sw.js` so the browser treats it as scoped to the entire origin.
- Next.js 16 App Router uses the `metadata` export (type `Metadata`) and optional `viewport` export (type `Viewport`) in `layout.tsx`. Do NOT use the older `generateMetadata()` or `head.tsx` conventions.
- No new npm dependencies are required for this task.

#### Non-Goals (OUT OF SCOPE)
- Wake Lock logic (`navigator.wakeLock.request`) — that's Phase 4C
- ASR code, audio capture, MediaRecorder — Phase 4B/4C
- The `/speaker` page — Phase 4E
- Deepgram integration — Phase 4B
- Service worker caching strategies or fetch handlers
- Service worker registration with `updateViaCache` or scope options — keep it minimal
- Creating actual icon image files (only placeholder paths in manifest)
- PWA install prompt UI logic
- Generating a `robots.txt` or `sitemap.xml`
- Any changes to `next.config.ts` or `package.json`

#### Testable Acceptance Criteria
**T1: manifest.json validity**: Valid JSON with `name`, `short_name`, `start_url`, `display`, `orientation`, `theme_color`, `background_color`, `icons` fields; `display` = "standalone", `orientation` = "portrait", `theme_color` = "#0f172a", `background_color` = "#020617"

**T2: service worker exists with install/activate handlers**: Contains `self.addEventListener('install', ...)` with `skipWaiting()`, contains `self.addEventListener('activate', ...)` with `clients.claim()`, does NOT contain a `fetch` event listener.

**T3: layout.tsx includes PWA meta tags**: `metadata` export has `manifest: "/manifest.json"`, `appleWebApp: { capable: true, title: "Sermon Translator", statusBarStyle: "black-translucent" }`, `themeColor: "#0f172a"`. `viewport` export exists with `themeColor: "#0f172a"`, `width: "device-width"`, `initialScale: 1`. JSX contains a `<script>` tag calling `navigator.serviceWorker.register('/sw.js')`.

**T4: Build succeeds**: `pnpm --filter frontend build` exits with code 0.

**Test File Paths**: `packages/frontend/public/manifest.json`, `packages/frontend/public/sw.js`, `packages/frontend/src/app/layout.tsx`

#### Inspectable Acceptance Criteria
**I1**: Existing layout conventions preserved — Geist/Geist_Mono font setup untouched, `<html>` retains `lang="en"` and existing `className` with font variables and `h-full antialiased`, `<body>` retains `className="min-h-full flex flex-col"`.
**I2**: No new files beyond the three deliverables.
**I3**: Service worker minimal — no caching, no fetch handler, no Workbox/libraries, uses `skipWaiting()` and `clients.claim()`, plain JS.
**I4**: Theme color consistency — `theme_color` in manifest.json, `themeColor` in metadata export, and `themeColor` in viewport export all match `#0f172a`.

#### Relevant Files
| File | Role |
|------|------|
| `packages/frontend/public/manifest.json` | **Create** — PWA web app manifest |
| `packages/frontend/public/sw.js` | **Create** — Minimal service worker |
| `packages/frontend/src/app/layout.tsx` | **Modify** — Add PWA metadata, viewport, and SW registration script |
| `docs/implementation-plans/phase-4-speaker-pwa.md` | Reference — Step 1 PWA instructions |
| `docs/frontend-spec.md` | Reference — PWA Keep-Alive conventions |

#### Validation Plan
1. Static file presence: Confirm `manifest.json` and `sw.js` exist in `packages/frontend/public/`.
2. JSON validity: Parse `manifest.json` with `JSON.parse()` — no syntax errors, all required fields present, values match spec.
3. Service worker content: Grep for `install`, `activate`, `skipWaiting`, `clients.claim` in `sw.js`; confirm no `fetch` listener.
4. Layout inspection: Grep for `manifest`, `appleWebApp`, `statusBarStyle`, `themeColor`, `serviceWorker.register` in `layout.tsx`; confirm existing font setup untouched.
5. Build: Run `pnpm --filter frontend build` from repo root. Exit code 0, no errors.
6. Lighthouse check (optional manual): After deployment, run Lighthouse PWA audit on `/speaker`.

## Project Context

From `.ai/context.md`:

- **Project**: Translation Service — 0-Cost Real-Time Church Sermon Translation Pipeline (Indonesian → English)
- **Monorepo**: pnpm workspaces
- **Frontend**: Next.js + Tailwind CSS (hosted on Vercel), in `packages/frontend/`
- **Test Framework**: Vitest, test pattern `*.test.ts`, co-located with source files
- **Naming**: kebab-case for files/dirs, camelCase for functions/vars, PascalCase for types and React components
- **Imports**: Auto-sorted
- **Code Style**: TypeScript strict mode, named exports preferred
- **agy**: enabled — Implementer agent can offload work through agy

## Relevant Files

### File 1: `packages/frontend/src/app/layout.tsx` (to be modified)

Current contents:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

### File 2: `packages/frontend/public/` directory (where manifest.json and sw.js will be created)

Current contents: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`

### File 3: `docs/implementation-plans/phase-4-speaker-pwa.md` (reference)

Step 1 instructions: Add manifest.json, define sw.js for microphone permissions and keep-alive, configure Next.js layout metadata for PWA installation.

### File 4: `docs/frontend-spec.md` (reference)

Section "PWA Keep-Alive & Wake Lock" confirms PWA conventions: manifest.json and Service Worker for installable standalone app.

## Report Path

Absolute path for the implementation report:
`/home/ltanaka/github/translation-service/.ai/tasks/1718913000-p4a-pwa/implementation-report.md`

## Verification Commands

1. Check file existence: `ls -la packages/frontend/public/manifest.json packages/frontend/public/sw.js`
2. Validate JSON: `node -e "JSON.parse(require('fs').readFileSync('packages/frontend/public/manifest.json','utf8'))" && echo "OK"`
3. Check service worker content: `grep -c 'skipWaiting' packages/frontend/public/sw.js && grep -c 'clients.claim' packages/frontend/public/sw.js && grep -c "addEventListener.*'fetch'" packages/frontend/public/sw.js`
4. Check layout.tsx PWA metadata: `grep -c 'manifest.*manifest.json' packages/frontend/src/app/layout.tsx && grep -c 'appleWebApp' packages/frontend/src/app/layout.tsx && grep -c 'serviceWorker.register' packages/frontend/src/app/layout.tsx`
5. Build: `pnpm --filter frontend build`

## Constraints and Non-Goals

- Do NOT implement Wake Lock logic (Phase 4C)
- Do NOT implement ASR code, audio capture, MediaRecorder (Phase 4B/4C)
- Do NOT create the `/speaker` page (Phase 4E)
- Do NOT implement Deepgram integration (Phase 4B)
- Do NOT add service worker caching strategies or fetch handlers
- Do NOT create actual icon image files (only placeholder paths)
- Do NOT add PWA install prompt UI logic
- Do NOT modify `next.config.ts` or `package.json`
- Do NOT remove or alter existing font/className/Tailwind setup in layout.tsx
- Do NOT edit `.ai/tasks/**` except the implementation-report.md
- Do NOT commit, amend, or push
- Do NOT write test files

## Stop Conditions

Halt and report back if:
- Any requirement is unclear, destructive, or security-sensitive
- The task spec conflicts with the project context
- A file cannot be read or written as expected
- The build fails in a way that cannot be resolved by the scope of this task

## Explicit Instructions

- Preserve all unrelated changes and existing code.
- Write the implementation report at `/home/ltanaka/github/translation-service/.ai/tasks/1718913000-p4a-pwa/implementation-report.md` after completing all edits.
- The implementation report should have sections: Outcome, Files Changed, Decisions, Verification. Include Known Issues only if there are any.
- Do NOT commit, amend, or push any changes.
- Do NOT run the validator.
- Do NOT delete or modify existing files in `packages/frontend/public/` — only create new ones.
- When creating `manifest.json`, use JSON comments are NOT valid in JSON. Instead, describe placeholder icons in a note or use standard JSON only.
- For the `manifest.json` icons array, use:
  ```json
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
  ```
- For `layout.tsx`, the `viewport` export needs a `Viewport` type import from `"next"`.
- The `<script>` tag should be a self-closing JSX tag or a pair tag with template literal content inside `<body>` after `{children}`.
