# Agy Handoff — Phase 4E: Speaker Page UI

## Implementer Persona and Boundaries

You are the Implementer Agent.

Own implementation only after the task is specified and approved in `.ai/tasks/<NNN>-<task-id>/task-spec.md`. You are a custom implementation subagent used by orchestrator.

Responsibilities:
- Read `.ai/context.md` and the task spec before editing.
- Read the files listed in the task spec's `## Relevant Files` section. If those files import or reference other files you need to understand, read those too — but only as far as needed. Do not explore unrelated parts of the codebase.
- Make the smallest correct change that satisfies the task spec.
- Preserve unrelated user changes.
- Run the smallest relevant verification when practical.
- Write `.ai/tasks/<NNN>-<task-id>/implementation-report.md` with sections: Outcome, Files Changed, Decisions, Verification. Include Known Issues only if there are any.
- Run the project's test suite (using the test runner from `.ai/context.md`). Confirm that the task-specific tests pass. If pre-existing baseline tests fail, note them as Known Issues but do not chase them.

Boundaries:
- Do not edit `.ai/tasks/**` except the task's `implementation-report.md` and `agy-handoff.md`.
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

Implement Phase 4E: Speaker Page UI. Create the `/speaker` route in the Next.js frontend — the pastor's control console with: PIN gate for authentication, large start/stop toggle, pulsing animation while active, volume visualizer (CSS wave), connection status indicator, and a backup audio download button that compiles IndexedDB chunks.

## Task Spec

Path: `.ai/tasks/1718917000-p4e-speaker-page/task-spec.md`

Full contents:

```
# Phase 4E: Speaker Page UI — Task Specification

## Source Artifacts / Handoff Context

- **Planning handoff**: `.ai/tasks/1718917000-p4e-speaker-page/planning-handoff.md` (canonical scope, constraints, acceptance signals)
- `docs/implementation-plans/phase-4-speaker-pwa.md` Step 5 — /speaker page UI spec (PIN gate, start/stop toggle, volume visualizer, backup downloader)
- `docs/frontend-spec.md` "Speaker Console" section (lines 419–428) — UI components, PIN gate, controls, visual feedback, backup recording actions
- `packages/frontend/src/hooks/useAudioCapture.ts` — the `useAudioCapture` hook from Phase 4D, returning `{ isListening, start, stop, latestTranscribedText, error }`
- `.ai/context.md` — Tech stack confirmation: Next.js App Router, Tailwind CSS, `pnpm` workspaces, TypeScript strict, kebab-case files, PascalCase components
- All Phase 4A–4D dependencies are complete: PWA manifest, ASR providers, AudioOrchestrator, useAudioCapture hook

---

## Scope

Create a single `'use client'` page component:

**File**: `packages/frontend/src/app/speaker/page.tsx`

### UI States and Components

1. **PIN Gate** (shown when no PIN in `sessionStorage`):
   - Text input field for entering the speaker PIN
   - "Validate" / "Unlock" submit button
   - On submit: store the entered PIN in `sessionStorage` as `speaker_pin`
   - Simple, centered layout appropriate for mobile portrait
   - Error feedback if PIN is empty and user tries to submit

2. **Main Console** (shown after PIN is set):
   - **Start/Stop Toggle**: Large, prominent button — premium dark-theme styling
     - Idle state (not listening): labeled "Start Broadcast", dark indigo/slate styling
     - Active state (`isListening === true`): labeled "Stop Broadcast", red pulsing wave CSS animation, green glow accent indicating connected state
     - Uses `useAudioCapture(sermonId).start()` / `.stop()` on click
     - `sermonId` derived from a timestamp or a constant placeholder (e.g., `Date.now().toString()`)
   - **Connection Indicator**: Small colored dot
     - Green (`bg-green-400` with glow) when `isListening === true`
     - Red/neutral when not listening
   - **Volume Visualizer**: CSS-only animated bars (3–5 vertical bars) with a wave/pulse animation via Tailwind `animate-pulse` or a custom `@keyframes` animation. Placeholder visual — does not need to bind to real mic volume data. Animates only when `isListening === true`.
   - **Latest Transcribed Text**: Display area showing the latest raw Indonesian text from `useAudioCapture().latestTranscribedText`. Monospace or distinct styling to differentiate from translated text. Shows placeholder text ("Waiting for speech...") when empty.
   - **Latest Translated Text**: Display area for English translation output. Since `useAudioCapture` does not currently expose a translated-text state in its return interface, the page must use a helper approach — either a locally managed state that the implementer wires up (the hook's internal translation pipeline broadcasts to Supabase but does not surface the result to the component), or an additional callback/manual fetch. The display area must exist and show placeholder text ("Translation will appear here...") regardless. If the implementer cannot cleanly surface the translated text without modifying the hook, they should document the gap in a code comment and leave the area as a styled placeholder.
   - **Error Banner**: Red banner (`bg-red-900/50 border-red-500 text-red-100`) displayed when `useAudioCapture().error` is non-null. Shows the error message string.
   - **Backup Download Button**: A button labeled "Download Backup Audio"
     - Styled consistently with the premium dark theme
     - onClick handler present
     - Body of the handler: a TODO stub comment describing what needs to happen (open IndexedDB `SermonAudioBackup`, compile all chunks from `audio_chunks` object store into a single blob, trigger browser download). The full IndexedDB compilation logic is explicitly OUT OF SCOPE for this unit.
   - **Stop Button**: Red "Stop Broadcast" button that calls `stop()` and returns UI to the idle Start state.

---

## Execution

**Pipeline**: `implementer → validator`

1. **Implementer** creates `packages/frontend/src/app/speaker/page.tsx` per this spec and the handoff.
2. **Validator** confirms all acceptance criteria (testable + inspectable) and verifies the build passes.

---

## Non-Goals

- Supabase configuration, Edge Functions, ASR provider logic (already in `useAudioCapture` / Phase 4B–4D)
- TTS integration (Phase 5)
- Viewer page `/` (Phase 5)
- Full IndexedDB compilation logic for backup downloader (TODO stub acceptable)
- Real microphone volume data binding for the visualizer (CSS animation only)
- Modifying `useAudioCapture.ts` (if the hook needs an extension to expose translated text, that is a separate follow-up — the page must still render the translated-text display area regardless)
- Server component wrapper (page.tsx is `'use client'`)
- Any new files other than `page.tsx`

---

## Testable Acceptance Criteria

Each item below must be verifiable as true/false.

1. Navigating to `/speaker` renders the PIN gate (input field + submit button visible in the DOM).
2. Submitting a non-empty PIN hides the PIN gate and reveals the main console.
3. The PIN value is persisted in `sessionStorage` under the key `speaker_pin`.
4. The main console includes a Start Broadcast button when `isListening` is false.
5. Clicking Start Broadcast calls the hook's `start()` method.
6. The main console includes a Stop Broadcast button when `isListening` is true.
7. Clicking Stop Broadcast calls the hook's `stop()` method.
8. A connection indicator element exists in the DOM and its appearance differs based on `isListening` state.
9. A volume visualizer element (CSS animated bars) exists and animates only when `isListening` is true.
10. The latest transcribed text display exists and renders `latestTranscribedText` from the hook.
11. The latest translated text display area exists (placeholder text acceptable).
12. The error banner element appears in the DOM when `error` is non-null and is not visible when `error` is null.
13. A "Download Backup Audio" button exists with an onClick handler (stub implementation acceptable).
14. Running `pnpm --filter frontend build` succeeds without errors related to this file.

### Test File Paths

- Not applicable for this unit — validation is manual browser inspection + build verification. No new test files are created.

---

## Inspectable Acceptance Criteria

These are qualitative checks for the validator.

1. **Dark theme**: The page root uses `bg-slate-950` background and `text-slate-100` foreground. No light backgrounds or default browser white backgrounds are visible on the speaker page.
2. **Responsive layout**: The PIN gate and main console render correctly on a narrow viewport (375px wide, mobile portrait). Buttons are large enough for finger tapping (minimum 48px touch target).
3. **Premium styling**: The Start/Stop toggle button uses indigo-500 accents, pulsing red wave animation when active, green glow when connected. Visual polish appropriate for a church production tool.
4. **'use client' directive**: The file begins with `'use client';` at line 1.
5. **Error banner styling**: Uses red-tinted dark background (`bg-red-900/50` or equivalent) with visible error text.
6. **No external UI libraries**: All styling is pure Tailwind CSS utility classes. No component libraries imported.
7. **Code conventions**: PascalCase component (`SpeakerPage` or default export function), kebab-case file (`page.tsx`), TypeScript types for props/states.

---

## Relevant Files

| File | Role |
|------|------|
| `packages/frontend/src/app/speaker/page.tsx` | **New file** — the speaker page component |
| `packages/frontend/src/hooks/useAudioCapture.ts` | Imported hook providing `{ isListening, start, stop, latestTranscribedText, error }` |
| `packages/frontend/src/app/layout.tsx` | Root layout (Geist font, PWA meta, service worker registration) |
| `packages/frontend/src/app/globals.css` | Global styles (Tailwind directives) |
| `packages/frontend/tailwind.config.ts` | Tailwind configuration (ensure `bg-slate-950` and `indigo-500` are available) |
| `packages/frontend/package.json` | Build scripts |

---

## Validation Plan

1. **Build check**: Run `pnpm --filter frontend build`. Confirm zero errors introduced by the new file (pre-existing warnings are acceptable).
2. **Browser inspection**: Start the dev server (`pnpm --filter frontend dev`), navigate to `http://localhost:3000/speaker`:
   - Confirm PIN gate appears.
   - Enter any PIN string, submit, confirm console appears and PIN is in `sessionStorage`.
   - Confirm Start button is visible and styled correctly on desktop and mobile viewport (375px).
   - Confirm error banner is absent when `error` is null.
   - Confirm Download Backup Audio button is present.
   - Confirm translated text display area exists.
3. **Dark theme audit**: Inspect the page background in browser DevTools — confirm `bg-slate-950` is applied to the root container.
4. **'use client' check**: Confirm the file begins with `'use client';`.
5. **Hook import check**: Confirm `useAudioCapture` is imported from the correct relative path.

---

## Open Questions

1. **Translated text not exposed by the hook**: The `useAudioCapture` hook (4D) returns `{ isListening, start, stop, latestTranscribedText, error }` but does **not** expose a `latestTranslatedText` state. The translation result is used internally to update a history buffer and broadcast via Supabase Realtime, but is never stored in a component-visible state. The implementer must decide: (a) extend the hook to also return `latestTranslatedText` (minor scope creep, simplest fix), or (b) build a parallel mechanism in the page to capture translated output. The planning handoff explicitly lists "Latest translated text display (English output)" as IN SCOPE. This is a **decision needed from the orchestrator** before implementation. The recommended approach is option (a) — adding a `latestTranslatedText` state to the hook — as it is the minimal path with the least duplication.
2. **Sermon ID sourcing**: The `useAudioCapture` hook requires a `sermonId` string. The handoff does not specify a source. Implementer should use a timestamp-based placeholder (`const sermonId = useRef(Date.now().toString()).current`) that is stable across re-renders.
3. **Stop confirmation**: Should the Stop button have a confirmation step (e.g., "Are you sure?") to prevent accidental broadcast termination during a sermon? The handoff is silent on this. Implementer may add a simple confirmation if desired, or proceed with a direct stop. This is left to implementer discretion.

---

## Decision Log

| Decision | Rationale | Source |
|----------|-----------|--------|
| Single file: `page.tsx` only | Handoff scope: one unit, one file | Planning handoff line 13 |
| CSS-only volume visualizer | Real mic data binding deferred to enhancement phase | Planning handoff line 55 |
| Backup downloader: TODO stub | Full IndexedDB compilation is complex; button + placeholder acceptable | Planning handoff line 54 |
| `useAudioCapture` imported, not reimplemented | Hook is a Phase 4D dependency | Planning handoff lines 5, 33 |
| Dark theme: `bg-slate-950` / `text-slate-100` / `indigo-500` | Church environment requirement | Planning handoff line 32, frontend-spec line 400 |
| No test file created | UI-only manual verification; build check sufficient | Acceptance signals list only build + visual checks |
```

## Project Context

`.ai/context.md` key points:
- **Project**: 0-Cost Real-Time Church Sermon Translation Pipeline (Indonesian → English)
- **Tech Stack**: TypeScript, Next.js + Tailwind CSS, Supabase, DeepSeek V4-Flash, pnpm
- **Monorepo**: packages/frontend (Next.js app), packages/edge-functions (Supabase Edge Functions), packages/shared (types)
- **Test Framework**: Vitest, test pattern `*.test.ts` co-located
- **Conventions**: kebab-case files, PascalCase components, TypeScript strict, named exports preferred
- **Agy**: enabled

## Relevant Files

### 1. `packages/frontend/src/hooks/useAudioCapture.ts` (full contents)

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AudioOrchestrator } from '../services/speech/AudioOrchestrator';

export interface UseAudioCaptureResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  latestTranscribedText: string;
  error: string | null;
}

export function useAudioCapture(sermonId: string): UseAudioCaptureResult {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscribedText, setLatestTranscribedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orchestratorRef = useRef<AudioOrchestrator | null>(null);
  const sequenceRef = useRef<number>(1);
  const historyRef = useRef<{ raw: string; translated: string }[]>([]);
  const channelRef = useRef<any>(null);

  const start = async () => {
    try {
      setError(null);

      // 1. Fetch Speaker configuration (PIN and active ASR provider choice)
      const pin = sessionStorage.getItem('speaker_pin') || '';
      const providerType = (localStorage.getItem('asr_provider') || 'deepgram') as 'deepgram' | 'webspeech';
      const deepgramKey = localStorage.getItem('deepgram_api_key') || '';

      // 2. Initialize Supabase Realtime Broadcast Channel
      channelRef.current = supabase.channel('sermon-live');
      await channelRef.current.subscribe();

      // 3. Instantiate and run orchestrator with text capture handler
      orchestratorRef.current = new AudioOrchestrator(
        sermonId,
        providerType,
        { apiKey: deepgramKey },
        async (rawText) => {
          setLatestTranscribedText(rawText);

          try {
            // Send to Edge Function for translation (passing PIN and history context)
            const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-admin-pin': pin,
              },
              body: JSON.stringify({
                raw_text: rawText,
                history: historyRef.current,
              }),
            });

            if (!response.ok) {
              throw new Error(`Translation server error: ${response.statusText}`);
            }

            const data = await response.json();
            const translatedText = data.translated_text;

            if (!translatedText) {
              throw new Error('Translation response missing translated_text');
            }

            // Update in-memory sliding history (max 3 items)
            const updatedHistory = [...historyRef.current, { raw: rawText, translated: translatedText }];
            if (updatedHistory.length > 3) updatedHistory.shift();
            historyRef.current = updatedHistory;

            // Broadcast final translation ephemerally to all viewers
            if (channelRef.current) {
              await channelRef.current.send({
                type: 'broadcast',
                event: 'translation_segment',
                payload: {
                  sequence_number: sequenceRef.current,
                  raw_text: rawText,
                  translated_text: translatedText,
                  timestamp: Date.now(),
                },
              });
              sequenceRef.current += 1;
            }
          } catch (apiErr: any) {
            console.error('Translation pipeline error:', apiErr.message);
            setError(`Translation failed: ${apiErr.message}`);
          }
        }
      );

      await orchestratorRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      setError(err.message);
      setIsListening(false);
    }
  };

  const stop = async () => {
    if (orchestratorRef.current) {
      await orchestratorRef.current.stop();
      orchestratorRef.current = null;
    }
    if (channelRef.current) {
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  return { isListening, start, stop, latestTranscribedText, error };
}
```

### 2. `packages/frontend/src/app/layout.tsx` (full contents)

```typescript
import type { Metadata, Viewport } from "next";
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Sermon Translator",
    statusBarStyle: "black-translucent",
  },
  themeColor: "#0f172a",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
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
      <body className="min-h-full flex flex-col">
        {children}
        <script>{`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}</script>
      </body>
    </html>
  );
}
```

### 3. `packages/frontend/src/app/globals.css` (full contents)

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

### 4. `packages/frontend/package.json` (full contents)

```json
{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shared": "workspace:*",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### 5. `tailwind.config.ts`

File does not exist. This project uses Tailwind CSS v4 which is configured via CSS (`@import "tailwindcss"` and `@theme inline {}`) rather than a JavaScript config file. The `bg-slate-950`, `indigo-500`, `text-slate-100`, `bg-green-400`, `bg-red-900/50`, `border-red-500`, `text-red-100` etc. are all built-in Tailwind v4 colors available by default.

## Report Path

Absolute path: `/home/ltanaka/github/translation-service/.ai/tasks/1718917000-p4e-speaker-page/implementation-report.md`

## Verification Commands

1. `pnpm --filter frontend build` — must succeed with zero errors related to the new file.

## Constraints and Non-Goals

- **IN SCOPE**: `packages/frontend/src/app/speaker/page.tsx` — full page component with PIN gate, start/stop toggle, connection indicator, volume visualizer, transcribed/translated text display, error banner, backup download button (stub).
- **OUT OF SCOPE**: Supabase config, edge functions, ASR logic (already in hook), TTS, viewer page (Phase 5), IndexedDB compilation logic, real mic volume data binding.
- **MODIFYING THE HOOK IS OPTIONAL BUT RECOMMENDED**: The task spec states "Modifying `useAudioCapture.ts`" is a non-goal, BUT the Open Questions section explicitly recommends Option A — adding `latestTranslatedText` to the hook as "the minimal path with the least duplication." The preferred approach is to modify the hook to also expose `latestTranslatedText`. This is a deliberate exception to the non-goal.
- No new files other than `page.tsx` (unless modifying the hook).
- Dark theme: `bg-slate-950` / `text-slate-100` / `indigo-500`.
- No external UI libraries — pure Tailwind + React.
- File begins with `'use client';`.
- PascalCase component (`SpeakerPage`), kebab-case file (`page.tsx`).

## Stop Conditions

- Stop if build fails with errors unrelated to pre-existing warnings.
- Stop if requirements are unclear, destructive, security-sensitive, or conflict with the task spec.

## Explicit Instructions

1. **Modify `packages/frontend/src/hooks/useAudioCapture.ts`** to add `latestTranslatedText` state:
   - Add `latestTranslatedText: string` to the `UseAudioCaptureResult` interface.
   - Add `const [latestTranslatedText, setLatestTranslatedText] = useState('');` state variable.
   - In the `onTextCaptured` callback, after `const translatedText = data.translated_text;` (approximately line 63), call `setLatestTranslatedText(translatedText);`.
   - Return `latestTranslatedText` in the return object.

2. **Create `packages/frontend/src/app/speaker/page.tsx`**:
   - `'use client';` at line 1.
   - Import `useAudioCapture` from `../../hooks/useAudioCapture`.
   - Import `useState`, `useRef` from `react`.
   - Default-export a function component `SpeakerPage` (or use a named function and default export).
   - PIN gate: shown when `sessionStorage.getItem('speaker_pin')` is null/empty. Text input + submit button. On submit, store PIN in `sessionStorage` as `speaker_pin`, set a local state to show console.
   - Sermon ID: `const sermonIdRef = useRef(Date.now().toString());` — stable across re-renders.
   - Use the hook: `const { isListening, start, stop, latestTranscribedText, latestTranslatedText, error } = useAudioCapture(sermonIdRef.current);`
   - Main console:
     - Start/Stop toggle: large button. Idle: "Start Broadcast" (indigo-500 styles). Active: "Stop Broadcast" (red with pulsing animation).
     - Connection indicator: small dot, green when listening, neutral otherwise.
     - Volume visualizer: 3-5 CSS animated bars. Animate only when `isListening`.
     - Latest transcribed text: display area showing `latestTranscribedText`, placeholder "Waiting for speech..." when empty. Monospace font.
     - Latest translated text: display area showing `latestTranslatedText`, placeholder "Translation will appear here..." when empty.
     - Error banner: shown when `error` is non-null. `bg-red-900/50 border-red-500 text-red-100`.
     - Backup download button: "Download Backup Audio" with onClick handler containing TODO stub comment.
     - Stop button: same as the toggle in active state, calls `stop()`.
   - All styling with Tailwind CSS utility classes only.
   - Mobile-first responsive design.

3. **Write implementation report** at the specified report path after completing all edits.

4. **Do not commit, amend, or push.**

5. **Do not write test files.**

6. **Preserve unrelated changes.**
