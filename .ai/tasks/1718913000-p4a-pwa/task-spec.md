# Phase 4A: PWA Configuration — Task Specification

## Source Artifacts / Handoff Context

- **Planning Handoff**: `.ai/tasks/1718913000-p4a-pwa/planning-handoff.md` — defines scope, constraints, acceptance signals, and non-goals.
- **Phase 4 Implementation Plan**: `docs/implementation-plans/phase-4-speaker-pwa.md` Step 1 — PWA manifest and service worker instructions.
- **Frontend Spec**: `docs/frontend-spec.md` Section "PWA Keep-Alive & Wake Lock" — wake lock code (out of scope for 4A, belongs to 4C) but confirms PWA conventions and the `Screen Wake Lock API` usage.
- **Existing Codebase**: `packages/frontend/` Next.js 16 App Router scaffold from Phase 1. Current `layout.tsx` uses `metadata` export, `<html>` with Tailwind classes.

## Scope

This is a single-unit task to configure the Next.js frontend as an installable Progressive Web App for the speaker's mobile device. It has no dependencies on other Phase 4 units (4B–4E).

### Deliverables

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

### Implementation Notes

- The `manifest.json` must be served from the Next.js `public/` directory, which maps to the root URL path (`/manifest.json`).
- The `sw.js` must also be in `public/` to be served at `/sw.js` so the browser treats it as scoped to the entire origin.
- Next.js 16 App Router uses the `metadata` export (type `Metadata`) and optional `viewport` export (type `Viewport`) in `layout.tsx`. Do NOT use the older `generateMetadata()` or `head.tsx` conventions.
- No new npm dependencies are required for this task.

## Execution

Pipeline: **implementer → validator**

1. **Implementer** — Create the three files (`manifest.json`, `sw.js`, updated `layout.tsx`) per the Deliverables above.
2. **Validator** — Verify all acceptance criteria (testable and inspectable) below. Run `pnpm --filter frontend build` to confirm a clean build.

## Non-Goals

The following are explicitly OUT OF SCOPE for this unit and should NOT be implemented:

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

## Testable Acceptance Criteria

### T1: manifest.json validity
- **Given**: the file `packages/frontend/public/manifest.json` exists
- **When**: the file is parsed as JSON
- **Then**: it is valid JSON with `name`, `short_name`, `start_url`, `display`, `orientation`, `theme_color`, `background_color`, and `icons` fields all present
- **And**: `display` equals `"standalone"`, `orientation` equals `"portrait"`, `theme_color` equals `"#0f172a"`, `background_color` equals `"#020617"`

### T2: service worker exists with install/activate handlers
- **Given**: the file `packages/frontend/public/sw.js` exists
- **When**: the file content is inspected
- **Then**: it contains `self.addEventListener('install', ...)` with `skipWaiting()`
- **And**: it contains `self.addEventListener('activate', ...)` with `clients.claim()`
- **And**: it does NOT contain a `fetch` event listener

### T3: layout.tsx includes PWA meta tags
- **Given**: the file `packages/frontend/src/app/layout.tsx`
- **When**: the file content is inspected
- **Then**: the `metadata` export includes `manifest: "/manifest.json"`
- **And**: the `metadata` export includes `appleWebApp: { capable: true, title: "Sermon Translator", statusBarStyle: "black-translucent" }`
- **And**: the `metadata` export includes `themeColor: "#0f172a"`
- **And**: a `viewport` export exists with `themeColor: "#0f172a"`, `width: "device-width"`, `initialScale: 1`
- **And**: the JSX contains a `<script>` tag (inside `<body>`) that calls `navigator.serviceWorker.register('/sw.js')`

### T4: Build succeeds
- **Given**: the project is at the monorepo root
- **When**: `pnpm --filter frontend build` is run
- **Then**: the build completes with exit code 0 and no errors

### Test File Paths

- `packages/frontend/public/manifest.json`
- `packages/frontend/public/sw.js`
- `packages/frontend/src/app/layout.tsx`

## Inspectable Acceptance Criteria

### I1: Existing layout conventions preserved
- The current Tailwind font setup (`Geist`, `Geist_Mono`) is untouched
- The `<html>` tag retains `lang="en"` and the existing `className` with font variables and `h-full antialiased`
- The `<body>` tag retains `className="min-h-full flex flex-col"`

### I2: No new files beyond the three deliverables
- Only `manifest.json`, `sw.js`, and the updated `layout.tsx` are created or modified
- No changes to `package.json`, `next.config.ts`, `tsconfig.json`, or any other file

### I3: Service worker minimal and standards-compliant
- No caching, no `fetch` handler, no `Workbox` or libraries
- Uses `skipWaiting()` in install, `clients.claim()` in activate
- Plain JavaScript; no TypeScript, no ESM imports (service worker has special module rules)

### I4: Theme color consistency
- `theme_color` in `manifest.json`, `themeColor` in `metadata` export, and `themeColor` in `viewport` export all match `#0f172a` (dark slate)

## Relevant Files

| File | Role |
|------|------|
| `packages/frontend/public/manifest.json` | **Create** — PWA web app manifest |
| `packages/frontend/public/sw.js` | **Create** — Minimal service worker |
| `packages/frontend/src/app/layout.tsx` | **Modify** — Add PWA metadata, viewport, and SW registration script |
| `docs/implementation-plans/phase-4-speaker-pwa.md` | Reference — Step 1 PWA instructions |
| `docs/frontend-spec.md` | Reference — PWA Keep-Alive conventions |

## Validation Plan

1. **Static file presence**: Confirm `manifest.json` and `sw.js` exist in `packages/frontend/public/`.
2. **JSON validity**: Parse `manifest.json` with `JSON.parse()` — no syntax errors, all required fields present, values match spec.
3. **Service worker content**: Grep for `install`, `activate`, `skipWaiting`, `clients.claim` in `sw.js`; confirm no `fetch` listener.
4. **Layout inspection**: Grep for `manifest`, `appleWebApp`, `statusBarStyle`, `themeColor`, `serviceWorker.register` in `layout.tsx`; confirm existing font setup untouched.
5. **Build**: Run `pnpm --filter frontend build` from repo root. Exit code 0, no errors.
6. **Lighthouse check (optional manual)**: After deployment, run Lighthouse PWA audit on `/speaker` — expect green for "Web app manifest", "Service worker", and "Installable" categories (may show warnings for missing icons which is expected since we use placeholder paths).

## Open Questions

None. The PWA requirements are well-defined by the planning handoff and source context.
