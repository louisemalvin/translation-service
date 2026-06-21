# Phase 4A: PWA Configuration — Planning Handoff

- **User Intent**: Configure the Next.js frontend as an installable Progressive Web App for the speaker's mobile device. This includes the web app manifest, service worker for microphone keep-alive, and meta tags for iOS/Android PWA installation.

- **Conversation-Derived Context**: Phase 4 is decomposed into 5 sequential units (4A → 4E). This is Unit 4A, which has no dependencies on other Phase 4 units. Phase 1 created the Next.js frontend scaffold at packages/frontend/. The PWA files go under packages/frontend/public/ and packages/frontend/src/app/layout.tsx.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-4-speaker-pwa.md` Step 1 — PWA Manifest and service worker instructions
  - `docs/frontend-spec.md` Section "PWA Keep-Alive & Wake Lock" — wake lock code, PWA conventions
  - Existing: `packages/frontend/` with Next.js scaffold from Phase 1

- **Proposed Task Shape**: Single-unit task: create manifest.json, sw.js service worker, and update the Next.js root layout with PWA meta tags.

- **Assigned Output Path(s)**: `.ai/tasks/1718913000-p4a-pwa/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `packages/frontend/public/manifest.json` (PWA manifest with name "Sermon Translator", icons placeholder, display standalone, orientation portrait), `packages/frontend/public/sw.js` (basic service worker to register microphone permissions and keep alive), `packages/frontend/src/app/layout.tsx` (update with PWA meta tags: apple-mobile-web-app-capable, viewport, theme-color dark)
  - OUT OF SCOPE: Wake lock logic (that's 4C), ASR code, audio capture, /speaker page, Deepgram integration

- **Constraints**:
  - Files must be in packages/frontend/ (Next.js app directory)
  - manifest.json: display standalone, theme_color #0f172a (dark slate), background_color #020617
  - service worker: minimal — handle install/activate lifecycle, no caching strategy needed yet
  - Meta tags: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style black-translucent, viewport, theme-color
  - Follow existing Next.js conventions from Phase 1 scaffold

- **Acceptance Signals**:
  1. `packages/frontend/public/manifest.json` exists and is valid JSON
  2. `packages/frontend/public/sw.js` exists with install/activate handlers
  3. `packages/frontend/src/app/layout.tsx` includes PWA meta tags in <head>
  4. Building the frontend (`pnpm --filter frontend build`) succeeds without errors

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the PWA files and updates layout. Validator confirms acceptance criteria. All Phase 4 units will be committed together after 4E completes.

- **Open Questions / Stop Conditions**:
  - None. The PWA requirements are well-defined.
