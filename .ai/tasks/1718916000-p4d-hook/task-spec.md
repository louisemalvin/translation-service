# Phase 4D: useAudioCapture Hook & Supabase Client — Task Specification

## Source Artifacts / Handoff Context

| Artifact | Path | Relevance |
|----------|------|-----------|
| Planning Handoff | `.ai/tasks/1718916000-p4d-hook/planning-handoff.md` | Canonical scope, constraints, acceptance signals |
| Phase 4 Implementation Plan | `docs/implementation-plans/phase-4-speaker-pwa.md` | Step 4 — useAudioCapture hook specification |
| Frontend Spec | `docs/frontend-spec.md` | Clean React UI Hook Abstraction (lines 246–365) — complete code blueprint |
| Realtime Broadcast Spec | `docs/realtime-broadcast.md` | WebSocket channel config, broadcast payload schema, security model |
| AudioOrchestrator (4C output) | `packages/frontend/src/services/speech/AudioOrchestrator.ts` | Dependency: hook instantiates and wires this orchestrator |
| SpeechToTextProvider interface | `packages/frontend/src/services/speech/SpeechToTextProvider.ts` | Interface consumed by orchestrator |
| DeepgramSpeechProvider | `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` | Concrete provider, constructor takes `apiKey: string` |
| WebSpeechProvider | `packages/frontend/src/services/speech/WebSpeechProvider.ts` | Fallback provider |
| wakeLock util | `packages/frontend/src/lib/wakeLock.ts` | Existing lib utility (already extracted from blueprint) |
| Translate Edge Function (Phase 3) | `supabase/functions/translate/index.ts` | Accepts `POST { raw_text, history }` with `x-admin-pin` header; returns `{ translated_text }` |
| Frontend .env.local | `packages/frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Frontend package.json | `packages/frontend/package.json` | Dependencies baseline; `@supabase/supabase-js` not yet present |
| pnpm workspace | `pnpm-workspace.yaml` | Package manager: pnpm |

## Scope

This is a **single-unit task** producing exactly two new files and one dependency addition:

1. **`packages/frontend/src/lib/supabaseClient.ts`** — Supabase JS client initialization module
2. **`packages/frontend/src/hooks/useAudioCapture.ts`** — React hook: the single boundary between UI and audio capture / translation / broadcast pipeline
3. **Dependency**: Add `@supabase/supabase-js` at `^2.39.0` to `packages/frontend/package.json`

The hook instantiates `AudioOrchestrator` (from Phase 4C), wires it to the Edge Function translation HTTP call, manages a sliding 3-segment in-memory history, and broadcasts translated segments over the Supabase Realtime `sermon-live` channel.

## Non-Goals

- `/speaker` page UI (Phase 4E)
- Any React components or JSX
- TTS (Text-to-Speech) — Phase 5
- Viewer page `/` — Phase 5
- AudioOrchestrator, DeepgramSpeechProvider, WebSpeechProvider, wakeLock — already exist from Phase 4A–4C; do not modify them
- IndexedDB backup downloader — Phase 4E
- PWA manifest / service worker — Phase 4A
- Unit tests (not in acceptance criteria)

## Execution

### Pipeline

```
implementer → validator
```

### Deliverables

#### 1. `packages/frontend/src/lib/supabaseClient.ts`

Create this file. It must:

- Import `createClient` from `@supabase/supabase-js`
- Read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env`
- Call `createClient(url, anonKey)` and export the resulting client as a named constant, e.g. `export const supabase = createClient(...)`
- Use no additional options or config (the anon-key-only client is sufficient for public channel subscription and broadcast)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 2. `packages/frontend/src/hooks/useAudioCapture.ts`

Create this file. Follow the code blueprint at `docs/frontend-spec.md` lines 246–365 exactly, with these implementation details verified against existing source artifacts:

**Imports:**
- `useState`, `useEffect`, `useRef` from `react`
- `supabase` from `../lib/supabaseClient`
- `AudioOrchestrator` from `../services/speech/AudioOrchestrator` — the existing class at `packages/frontend/src/services/speech/AudioOrchestrator.ts` (constructs with `(sermonId, providerType, config, onTextCaptured)`)

**Interface:**
```typescript
export interface UseAudioCaptureResult {
  isListening: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  latestTranscribedText: string;
  error: string | null;
}
```

**Hook signature:** `export function useAudioCapture(sermonId: string): UseAudioCaptureResult`

**Internal refs:**
- `orchestratorRef` — `useRef<AudioOrchestrator | null>(null)`
- `sequenceRef` — `useRef<number>(1)` — monotonically incrementing broadcast counter
- `historyRef` — `useRef<{ raw: string; translated: string }[]>([])` — sliding last 3 segments
- `channelRef` — `useRef<ReturnType<typeof supabase.channel> | null>(null)` — or typed as `any` per blueprint

**`start()` logic:**
1. Clear error state: `setError(null)`
2. Read from storage:
   - `const pin = sessionStorage.getItem('speaker_pin') || ''`
   - `const providerType = (localStorage.getItem('asr_provider') || 'deepgram') as 'deepgram' | 'webspeech'`
   - `const deepgramKey = localStorage.getItem('deepgram_api_key') || ''`
3. Create and subscribe to Supabase Realtime channel:
   - `channelRef.current = supabase.channel('sermon-live')` — use the static channel name `sermon-live` as specified in `docs/realtime-broadcast.md` (the blueprint uses `sermon_${sermonId}` but the canonical broadcast spec says `sermon-live`; the handoff constraint also says `sermon-live`)
   - `await channelRef.current.subscribe()`
4. Instantiate `AudioOrchestrator`:
   - `new AudioOrchestrator(sermonId, providerType, { apiKey: deepgramKey }, async (rawText) => { ... })`
5. In the `onTextCaptured` callback:
   - `setLatestTranscribedText(rawText)`
   - `fetch()` to `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate` with:
     - Method: `POST`
     - Headers: `Content-Type: application/json`, `x-admin-pin: pin`
     - Body: `JSON.stringify({ raw_text: rawText, history: historyRef.current })`
   - On non-ok response: throw with status text
   - Parse response JSON, extract `data.translated_text`
   - Update `historyRef`: append `{ raw: rawText, translated: translatedText }`, shift if `> 3`
   - Broadcast via `channelRef.current.send({ type: 'broadcast', event: 'translation_segment', payload: { sequence_number: sequenceRef.current, raw_text: rawText, translated_text: translatedText, timestamp: Date.now() } })`
   - Increment `sequenceRef.current`
   - On any error within callback: `console.error` and `setError(...)` — do NOT throw/crash
6. `await orchestratorRef.current.start()`
7. `setIsListening(true)`
8. Wrap all in try/catch; on error set error state and `setIsListening(false)`

**`stop()` logic:**
- If `orchestratorRef.current`: `await orchestratorRef.current.stop()` then null it
- If `channelRef.current`: `await channelRef.current.unsubscribe()` then null it (use `supabase.removeChannel()` if available per SDK version, otherwise just unsubscribe and null)
- `setIsListening(false)`

**`useEffect` cleanup:**
- Return a cleanup function that calls `stop()` on unmount (or directly stops orchestrator and unsubscribes channel — follow blueprint pattern)

**Return:** `{ isListening, start, stop, latestTranscribedText, error }`

#### 3. Dependency: `@supabase/supabase-js`

Add to `packages/frontend/package.json` under `dependencies`:

```json
"@supabase/supabase-js": "^2.39.0"
```

Then run `pnpm install` from the workspace root to install and update the lockfile.

> **Note:** `^2.39.0` is the specified version. The `supabase.channel().send()` API (broadcast on Realtime channels) is stable in this version line.

### Channel Name Decision

The planning handoff and `docs/realtime-broadcast.md` specify the channel name as **`sermon-live`** (static). The frontend-spec blueprint code uses a dynamic `sermon_${sermonId}` naming but the broadcast spec and handoff constraints override this — use the static `sermon-live` channel name. This also aligns with the viewer subscription code in `docs/frontend-spec.md` lines 370–393.

## Testable Acceptance Criteria

1. **`supabaseClient.ts` exists and exports**: `packages/frontend/src/lib/supabaseClient.ts` creates and exports a configured Supabase client via `createClient()` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Hook has correct interface and return type**: `useAudioCapture(sermonId: string)` returns `UseAudioCaptureResult` with exactly `{ isListening, start, stop, latestTranscribedText, error }`.

3. **`start()` reads storage correctly**: Reads `speaker_pin` from `sessionStorage`, `asr_provider` from `localStorage` (default `'deepgram'`), `deepgram_api_key` from `localStorage`.

4. **`start()` creates channel and orchestrator**: Creates a Supabase Realtime channel named `sermon-live`, subscribes to it, and instantiates `AudioOrchestrator` with the correct constructor arguments.

5. **On text captured: translation pipeline fires**: Calls `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate` via `fetch()` with POST method, `Content-Type: application/json`, `x-admin-pin` header, and body `{ raw_text, history }`.

6. **On translation success: updates history and broadcasts**: Appends translated segment to `historyRef` (max 3 entries), broadcasts `{ type: 'broadcast', event: 'translation_segment', payload: { sequence_number, raw_text, translated_text, timestamp } }` via `channelRef.current.send()`.

7. **On translation error: sets error state, does not crash**: The hook catches fetch errors within the `onTextCaptured` callback, logs to console, calls `setError(...)`, and does NOT throw or crash the hook.

8. **`stop()` tears down**: Calls `orchestratorRef.current.stop()`, nulls the ref, calls `channelRef.current.unsubscribe()`, nulls the ref, sets `isListening` to false.

9. **useEffect cleanup on unmount**: The cleanup function stops the orchestrator and unsubscribes the channel (duplicate safety for unmount without explicit `stop()`).

10. **TypeScript compiles clean**: `tsc --noEmit` in `packages/frontend` passes with no errors.

11. **pnpm install succeeds**: `@supabase/supabase-js` installs cleanly and `pnpm install` completes without errors.

### Test File Paths

```
packages/frontend/src/lib/supabaseClient.ts
packages/frontend/src/hooks/useAudioCapture.ts
packages/frontend/package.json  (modified)
```

## Inspectable Acceptance Criteria

1. No modification to any existing file other than `packages/frontend/package.json`.
2. `supabaseClient.ts` uses the exact `createClient` import from `@supabase/supabase-js` — not the older `supabase-js` v1 API.
3. The hook file is self-contained; it does not import any UI components, page modules, or CSS.
4. Error handling in the `onTextCaptured` callback is a try/catch that catches fetch failures, JSON parse failures, and broadcast failures — each logs a distinct `console.error` and sets `error` state, none throws uncaught.
5. The sliding history (`historyRef`) uses `shift()` to trim beyond 3 entries — O(1) per shift (array of max 3 elements).

## Relevant Files

| File | Role | Action |
|------|------|--------|
| `packages/frontend/package.json` | Dependency manifest | **Modify** — add `@supabase/supabase-js: ^2.39.0` |
| `packages/frontend/src/lib/supabaseClient.ts` | Supabase client singleton | **Create** |
| `packages/frontend/src/hooks/useAudioCapture.ts` | React hook | **Create** |
| `packages/frontend/src/services/speech/AudioOrchestrator.ts` | Orchestrator (4C) | Read-only dependency — do NOT modify |
| `packages/frontend/src/services/speech/SpeechToTextProvider.ts` | Provider interface | Read-only dependency |
| `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` | Deepgram adapter | Read-only dependency |
| `packages/frontend/src/services/speech/WebSpeechProvider.ts` | Web Speech adapter | Read-only dependency |
| `packages/frontend/src/lib/wakeLock.ts` | Wake Lock utility | Read-only dependency |
| `packages/frontend/.env.local` | Environment variables | Read — contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `supabase/functions/translate/index.ts` | Edge Function (Phase 3) | Read — documents expected request/response contract |
| `docs/frontend-spec.md` | Code blueprint | Read — canonical hook implementation |
| `docs/realtime-broadcast.md` | Channel spec | Read — channel name and payload schema |
| `docs/implementation-plans/phase-4-speaker-pwa.md` | Implementation plan | Read — Step 4 |

## Validation Plan

1. **File existence**: Confirm both new files exist at the expected paths.
2. **TypeScript check**: Run `tsc --noEmit` in `packages/frontend` — must pass with zero errors.
3. **Dependency check**: Run `pnpm install` from workspace root — must complete without errors. Verify `@supabase/supabase-js` appears in `packages/frontend/node_modules`.
4. **Import check**: Verify `supabaseClient.ts` exports a client object and `useAudioCapture.ts` imports it. Verify the hook imports `AudioOrchestrator` from the correct path.
5. **Channel name**: Grep for `supabase.channel(` and confirm the argument is `'sermon-live'`.
6. **Storage keys**: Grep for `sessionStorage.getItem` and `localStorage.getItem` and confirm the exact keys: `speaker_pin`, `asr_provider`, `deepgram_api_key`.
7. **Translation URL**: Grep for `NEXT_PUBLIC_SUPABASE_URL` and `/functions/v1/translate` and confirm the Edge Function URL construction.
8. **History limit**: Grep for `historyRef` and `.length > 3` (or `.shift()`) and confirm sliding window logic.
9. **Error handling path**: Grep for `setError` inside the `onTextCaptured` callback — confirm it is wrapped in try/catch.
10. **Cleanup path**: Grep for `useEffect` and confirm the cleanup function stops both the orchestrator and the channel.

## Open Questions

1. **Channel name resolution**: The handoff says `sermon-live` (static). The frontend-spec blueprint uses `sermon_${sermonId}` (dynamic). This spec follows the handoff/broadcast-spec and uses `'sermon-live'`. If the dynamic-per-sermon channel pattern is needed later, it can be changed in Phase 4E or 5. No blocking issue.
