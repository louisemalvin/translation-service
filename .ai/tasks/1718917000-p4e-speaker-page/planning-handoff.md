# Phase 4E: Speaker Page UI — Planning Handoff

- **User Intent**: Build the `/speaker` route in the Next.js frontend. This is the pastor's control console with: PIN gate for authentication, large start/stop toggle, pulsing animation while active, volume visualizer (CSS wave), connection status indicator, and a backup audio download button that compiles IndexedDB chunks.

- **Conversation-Derived Context**: This is the final Phase 4 unit. All dependencies exist: PWA (4A), ASR providers (4B), AudioOrchestrator (4C), useAudioCapture hook (4D). The page uses the hook and renders UI based on its state. The page goes at `packages/frontend/src/app/speaker/page.tsx`. Design system: premium dark theme (bg-slate-950, text-slate-100) for church environments.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-4-speaker-pwa.md` Step 5 — /speaker page UI spec
  - `docs/frontend-spec.md` Section "Speaker Console" — UI components, PIN gate, controls, visual feedback, backup recording actions
  - `packages/frontend/src/hooks/useAudioCapture.ts` (from 4D)
  - `.ai/context.md` — Tailwind CSS, Next.js App Router

- **Proposed Task Shape**: Single-unit task: create the /speaker page with all UI components. One file, but rich UI with multiple states.

- **Assigned Output Path(s)**: `.ai/tasks/1718917000-p4e-speaker-page/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `packages/frontend/src/app/speaker/page.tsx` — full page component with:
    - PIN gate: input field, validate button, store in sessionStorage as `speaker_pin`
    - Start/Stop toggle: large button, premium styling, red pulsing wave animation when active, green glow when connected
    - Volume visualizer: CSS-based wave animation matching mic activity (simplified — use animated bars)
    - Connection indicator: green/red dot based on isListening state
    - Latest transcribed text display (raw Indonesian)
    - Latest translated text display (English output)
    - Error display (red banner when error is set)
    - Backup downloader: button to download audio from IndexedDB (use a helper function, or placeholder with TODO)
  - OUT OF SCOPE: Supabase config, edge functions, ASR logic (already in hook), TTS, viewer page (Phase 5)

- **Constraints**:
  - Next.js App Router: 'use client' directive (uses browser APIs)
  - Tailwind CSS for all styling
  - Dark theme: bg-slate-950, text-slate-100, accent indigo-500
  - Must use the useAudioCapture hook from 4D
  - PIN stored in sessionStorage as 'speaker_pin'
  - Responsive: works on mobile (portrait) — the pastor's phone
  - The backup downloader should have at minimum the button UI with an onClick handler. The actual IndexedDB compilation logic can be a TODO stub if too complex.
  - No external UI libraries — pure Tailwind + React
  - Server component wrapper if needed, but page.tsx should be 'use client'

- **Acceptance Signals**:
  1. Navigating to `/speaker` shows the PIN gate (input + submit button)
  2. After entering PIN, the main console appears (start button, indicators)
  3. Start button toggles between Start/Stop states
  4. isListening state shows green dot + pulsing animation
  5. Error state shows red error banner
  6. latestTranscribedText and translated text display areas exist
  7. Backup download button exists
  8. Page compiles and `pnpm --filter frontend build` succeeds
  9. Dark theme styling applied correctly (bg-slate-950, text-slate-100)

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the page. Validator confirms acceptance criteria. After 4E validation, ALL Phase 4 units will be committed together.

- **Open Questions / Stop Conditions**:
  - The backup downloader's full IndexedDB compilation is complex — acceptable to stub with a TODO comment and placeholder UI
  - Volume visualizer: a CSS-only animated bar set is acceptable (doesn't need real mic data binding — that's Phase 4 enhancement)
  - Stop if build fails with errors unrelated to pre-existing warnings
