# Phase 4B: ASR Provider Interface & Adapters — Task Specification

## Source Artifacts / Handoff Context

| Artifact | Path |
|---|---|
| Planning handoff | `.ai/tasks/1718914000-p4b-asr/planning-handoff.md` |
| Implementation plan (Step 2) | `docs/implementation-plans/phase-4-speaker-pwa.md` |
| Code blueprints | `docs/frontend-spec.md` § Modular Speech-to-Text Architecture (lines 54–148) |
| Project conventions | `.ai/context.md` (TypeScript strict, named exports, camelCase, kebab-case files) |

**Key handoff decisions:**
- ASR engine choices (Deepgram primary, Web Speech fallback) are settled. This task builds the interface + adapters only.
- Deepgram auth uses WebSocket subprotocol `['token', apiKey]` — as shown in `frontend-spec.md` blueprint.
- `apiKey` is injected via constructor; key management is out of scope.
- No React or Next.js dependencies — these are pure TypeScript service classes.

---

## Scope

This is a **single-unit task**. Create exactly three files under `packages/frontend/src/services/speech/`:

| # | File | Description |
|---|---|---|
| 1 | `SpeechToTextProvider.ts` | TypeScript interface defining the ASR provider contract |
| 2 | `DeepgramSpeechProvider.ts` | Concrete provider: WebSocket streaming to Deepgram Nova-2, 250ms MediaRecorder chunks, parses `is_final` transcripts |
| 3 | `WebSpeechProvider.ts` | Concrete provider: wraps browser `SpeechRecognition` API, Indonesian `id-ID`, continuous mode, auto-restart on silent timeouts |

### Interface Contract (`SpeechToTextProvider`)

```typescript
export interface SpeechToTextProvider {
  start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>;
  stop(): Promise<void>;
}
```

- `start()` begins capturing audio from the provided `MediaStream` and invokes `onTextCaptured` for each final, non-empty, trimmed transcript.
- `stop()` terminates all capture, closes connections, and cleans up resources.
- Both methods are async. `start()` must not resolve before the underlying connection/capture is fully initialized.
- The `stream` parameter is consumed read-only; providers never stop the stream's tracks (the orchestrator owns stream lifecycle).

### DeepgramSpeechProvider

**Constructor:** `constructor(apiKey: string)`

**WebSocket endpoint (hardcoded):**
```
wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000
```

**Behavior:**
1. `start()` opens a WebSocket with subprotocol `['token', apiKey]`.
2. On `onopen`: create a `MediaRecorder` from the stream with `{ mimeType: 'audio/webm' }`, set `ondataavailable` to send `event.data` (if > 0 bytes and socket open), call `mediaRecorder.start(250)`.
3. On websocket `onmessage`: `JSON.parse(event.data)`, read `data.channel?.alternatives?.[0]?.transcript` and `data.is_final`. If `is_final` and transcript is non-empty after trim, fire `onTextCaptured(transcript.trim())`.
4. On websocket `onerror`: log the error via `console.error`.
5. `stop()`: call `mediaRecorder?.stop()`, close WebSocket (if open), nullify references.

**Error handling:** Fail gracefully — log errors, never throw from event handlers. If the WebSocket or MediaRecorder fail to initialize, surface via `console.error` so the orchestrator can fall back.

### WebSpeechProvider

**No constructor arguments.**

**Behavior:**
1. `start()` detects `window.SpeechRecognition || window.webkitSpeechRecognition`, instantiates it.
2. Configures: `recognition.continuous = true`, `recognition.interimResults = false`, `recognition.lang = 'id-ID'`. Sets `isRunning = true`.
3. On `onresult`: iterate `event.results`, collect final transcripts (where `isFinal` is true), concatenate, and call `onTextCaptured` with the trimmed non-empty result.
4. On `onend`: if `isRunning` is still true, call `recognition.start()` to auto-restart after silent timeouts.
5. On `onerror`: log via `console.error`. If `isRunning`, the `onend` handler will still auto-restart.
6. `stop()`: set `isRunning = false`, call `recognition?.stop()`.

**TypeScript types:** Since `SpeechRecognition` is available via the `dom` lib but `webkitSpeechRecognition` is vendor-prefixed, add an inline type declaration or use a type assertion so strict mode compiles cleanly.

---

## Execution

**Pipeline:** `implementer` → `validator`

1. **Implementer** creates the three files following the blueprints in `docs/frontend-spec.md` § Modular Speech-to-Text Architecture (lines 54–148), adapting only as required for strict-mode TypeScript compatibility and project conventions.
2. **Validator** runs the acceptance criteria checks below and reports pass/fail with evidence.

---

## Non-Goals

The following are explicitly **out of scope** for this unit. They will be handled in later Phase 4 units:

- `AudioOrchestrator.ts` (Phase 4C)
- `useAudioCapture` React hook (Phase 4D)
- `/speaker` page UI (Phase 4E)
- IndexedDB audio backup logic
- Screen Wake Lock API
- Deepgram API key management or environment variable reading — `apiKey` is a plain constructor parameter
- Supabase Realtime integration
- Any translation/broadcast pipeline logic

---

## Testable Acceptance Criteria

### A. Interface Correctness

| # | Criterion | Verification |
|---|---|---|
| A1 | `SpeechToTextProvider.ts` exports a named TypeScript interface with `start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>` and `stop(): Promise<void>` | Inspect export |
| A2 | Both `DeepgramSpeechProvider` and `WebSpeechProvider` use `implements SpeechToTextProvider` | Inspect class declarations |
| A3 | All exports are **named** (not `export default`) | Inspect exports |

### B. DeepgramSpeechProvider Correctness

| # | Criterion | Verification |
|---|---|---|
| B1 | Constructor accepts `apiKey: string` | Inspect signature |
| B2 | WebSocket URL matches `wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000` | Inspect URL string |
| B3 | WebSocket subprotocol is `['token', this.apiKey]` | Inspect constructor call |
| B4 | MediaRecorder is created with `mimeType: 'audio/webm'` | Inspect MediaRecorder constructor |
| B5 | `mediaRecorder.start(250)` — 250ms chunk interval | Inspect call |
| B6 | `ondataavailable` sends only when `event.data.size > 0 && socket.readyState === WebSocket.OPEN` | Inspect guard |
| B7 | `onmessage` parses JSON, extracts `data.channel?.alternatives?.[0]?.transcript` and `data.is_final` | Inspect parsing logic |
| B8 | `onTextCaptured` fires only for `is_final && transcript.trim().length > 0` | Inspect conditional |
| B9 | `stop()` calls `mediaRecorder?.stop()`, closes socket, nullifies references | Inspect cleanup |

### C. WebSpeechProvider Correctness

| # | Criterion | Verification |
|---|---|---|
| C1 | Detects `window.SpeechRecognition \|\| window.webkitSpeechRecognition` | Inspect feature detection |
| C2 | Configures `continuous = true`, `interimResults = false`, `lang = 'id-ID'` | Inspect property assignments |
| C3 | `isRunning` flag set to `true` in `start()`, `false` in `stop()` | Inspect flag management |
| C4 | `onresult` iterates `event.results`, concatenates final transcripts, fires `onTextCaptured` with non-empty trimmed text | Inspect handler |
| C5 | `onend` calls `recognition?.start()` if `isRunning` is true (auto-restart on silent timeout) | Inspect handler |
| C6 | `onerror` logs via `console.error` | Inspect handler |
| C7 | `stop()` sets `isRunning = false`, calls `recognition?.stop()` | Inspect cleanup |

### D. Compilation

| # | Criterion | Verification |
|---|---|---|
| D1 | All three files compile cleanly with `tsc --noEmit` under the existing `packages/frontend/tsconfig.json` (strict mode enabled) | Run: `cd packages/frontend && npx tsc --noEmit` |

### E. No Framework Coupling

| # | Criterion | Verification |
|---|---|---|
| E1 | No `import` from `react`, `next`, or `next/*` in any of the three files | Grep imports |

### Test File Paths

No unit test files are required for this unit. The providers depend on browser APIs (`WebSocket`, `MediaRecorder`, `SpeechRecognition`) which require browser-level mocking infrastructure not yet present in the project. The compilation check (criterion D1) serves as the primary quality gate.

---

## Inspectable Acceptance Criteria

### I. No React or Next.js Imports

Grep the three source files for `from 'react'`, `from 'next'`, or `from 'next/`. Zero matches required.

### II. Named Exports Only

No `export default` in any of the three source files. Use `export interface SpeechToTextProvider` and `export class DeepgramSpeechProvider` / `export class WebSpeechProvider`.

### III. Code Blueprint Fidelity

The implementation must follow the structure shown in `docs/frontend-spec.md` lines 57–148. Deviations are permitted only for:
- TypeScript strict-mode fixes (e.g., type assertions for `window.webkitSpeechRecognition`, null checks)
- Project conventions (kebab-case filenames, camelCase members)
- Removing unused code from the blueprint (the blueprint includes `AudioOrchestrator` which is NOT in scope — ignore it)

### IV. File Locations

All three files must be at exactly:
- `packages/frontend/src/services/speech/SpeechToTextProvider.ts`
- `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts`
- `packages/frontend/src/services/speech/WebSpeechProvider.ts`

Parent directory `services/speech/` must be created if it does not exist.

---

## Relevant Files

| File | Role |
|---|---|
| `packages/frontend/src/services/speech/SpeechToTextProvider.ts` | **To create**: interface |
| `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` | **To create**: Deepgram WebSocket adapter |
| `packages/frontend/src/services/speech/WebSpeechProvider.ts` | **To create**: Web Speech API adapter |
| `docs/frontend-spec.md` (lines 54–148) | Canonical code blueprints |
| `docs/implementation-plans/phase-4-speaker-pwa.md` (Step 2, lines 19–28) | Functional specification |
| `packages/frontend/tsconfig.json` | TypeScript compiler configuration (strict mode) |
| `.ai/context.md` | Project conventions |

---

## Validation Plan

1. **Static analysis:** `cd packages/frontend && npx tsc --noEmit` — zero errors.
2. **Import audit:** Grep for `react`, `next`, `next/` imports — zero matches.
3. **Export audit:** Grep for `export default` in all three files — zero matches.
4. **Interface conformance:** Confirm both classes use `implements SpeechToTextProvider`.
5. **Deepgram URL audit:** Confirm exact WebSocket URL matches spec.
6. **WebSpeech config audit:** Confirm `lang = 'id-ID'`, `continuous = true`, `interimResults = false`, auto-restart logic on `onend`.

---

## Open Questions

1. **Deepgram WebSocket subprotocol auth `['token', apiKey]`:** The frontend-spec blueprint uses this pattern. The handoff notes it should be confirmed as correct for Deepgram's browser SDK. If incorrect, the implementer should flag a blocking issue rather than silently inventing a different auth method.

2. **TypeScript types for `window.webkitSpeechRecognition`:** The `dom` lib includes `SpeechRecognition` but `webkitSpeechRecognition` is vendor-prefixed and may not have type coverage. The implementer should add a minimal ambient declaration (e.g., `declare global { interface Window { webkitSpeechRecognition: typeof SpeechRecognition } }`) or use a type assertion so strict mode compiles cleanly.

3. **MediaRecorder mimeType fallback:** The blueprint uses `audio/webm` which is not supported in all browsers (notably iOS Safari may prefer `audio/mp4` or refuse the mimeType parameter). The implementer should use `audio/webm` as specified and note that browser compatibility handling belongs to the orchestrator (Phase 4C), not this unit.
