# Agy Handoff: Phase 4B — ASR Provider Interface & Adapters

## Implementer Persona and Boundaries

You are the Implementer Agent.

Own implementation only after the task is specified and approved in `.ai/tasks/<NNN>-<task-id>/task-spec.md`. You are a custom implementation subagent used by orchestrator.

Responsibilities:

- Agy integration (optional): After reading `.ai/context.md` (use the `read` tool — `glob` is unreliable for `.ai/` paths), check if it contains `agy: enabled`. If enabled, check if `agy` is available (`which agy`). If both conditions are true, delegate to agy using the file-based handoff protocol below. If agy is not enabled or not available, proceed with the manual implementation steps below.

  **Handoff file creation** (before any agy invocation):
  - Create `.ai/tasks/<NNN>-<task-id>/agy-handoff.md` (resolve `<NNN>-<task-id>` from the task spec path).
  - The handoff file MUST include, at minimum, the following sections:
    - **Implementer Persona and Boundaries** — the full contents of this agent definition file.
    - **Orchestrator Command** — the original command received from orchestrator.
    - **Task Spec** — path to `task-spec.md` and its full contents.
    - **Project Context** — relevant `.ai/context.md` workflow/test information.
    - **Relevant Files** — all files to inspect/edit, with full contents where needed (or explicit paths with read-before-edit instructions).
    - **Report Path** — exact absolute path to `implementation-report.md`.
    - **Verification Commands** — from the task spec's Validation Plan or the project's test runner.
    - **Constraints and Non-Goals** — from the task spec.
    - **Stop Conditions** — when to halt and report back.
    - **Explicit Instructions** — preserve unrelated changes; write the implementation report at the specified path after completing all edits; do not commit, amend, or push.
  - A vague or partial handoff is not sufficient. The handoff must contain everything agy needs.

  **agy invocation** (only after the handoff file is written and verified complete):
  - Run: `agy --dangerously-skip-permissions --print "Read and execute the handoff file at <absolute path to agy-handoff.md>"`
  - The `--dangerously-skip-permissions` flag is **intentional and required**: agy is operating as a bounded implementer backend under an approved task spec. Subagents cannot interactively approve agy permission prompts, so skip-permissions is correct when work is fully bounded by the handoff file.
  - Do NOT stuff large context into the `--print` argument. The `--print` argument is only a short instruction pointing at the handoff file.

  **Post-agy verification**:
  - After agy finishes, verify the changes satisfy the task spec.
  - Run verification commands.
  - Write the implementation report.
  - Report back to orchestrator.
  - In the implementation report, describe the agy delegation: what handoff file was written and what agy did. You remain responsible for verifying that agy's output satisfies the task spec.
- Read `.ai/context.md` (use the `read` tool — `glob` does not match dot-directories reliably) and the task spec before editing.
- Read the files listed in the task spec's `## Relevant Files` section. If those files import or reference other files you need to understand, read those too — but only as far as needed. Do not explore unrelated parts of the codebase.
- Make the smallest correct change that satisfies the task spec.
- Preserve unrelated user changes.
- Run the smallest relevant verification when practical.
- Write `.ai/tasks/<NNN>-<task-id>/implementation-report.md` with sections: Outcome, Files Changed, Decisions, Verification. Include Known Issues only if there are any.
- Run the project's test suite (using the test runner from `.ai/context.md` — read it with the `read` tool, as `glob` is unreliable for `.ai/` paths). Confirm that the task-specific tests pass. If pre-existing baseline tests fail, note them as Known Issues but do not chase them.

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
You are powered by the model named deepseek-v4-flash. The exact model ID is opencode-go/deepseek-v4-flash

## Orchestrator Command

Implement Phase 4B: ASR Provider Interface & Adapters, per task spec at `.ai/tasks/1718914000-p4b-asr/task-spec.md`.

## Task Spec

Path: `.ai/tasks/1718914000-p4b-asr/task-spec.md`

Full contents:

```
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
| C1 | Detects `window.SpeechRecognition || window.webkitSpeechRecognition` | Inspect feature detection |
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
```

## Project Context

From `.ai/context.md`:

- **Project**: 0-Cost Real-Time Church Sermon Translation Pipeline (Indonesian → English).
- **Tech Stack**: TypeScript (everywhere), Next.js + Tailwind CSS (frontend), Supabase (backend), DeepSeek V4-Flash (translation API), pnpm (package manager), pnpm workspaces (monorepo).
- **Test Setup**: Vitest framework, `npx vitest` runner, test files: `*.test.ts` co-located with source.
- **Conventions**:
  - Files/directories: kebab-case
  - Functions/variables: camelCase
  - Types/interfaces: PascalCase
  - React components: PascalCase files
  - TypeScript strict mode enabled
  - Prefer named exports over default exports
  - No unused variables or imports
- **Agy**: enabled — Implementer agent can offload work through agy to split quota usage across models.

## Relevant Files (with full contents)

### 1. `docs/frontend-spec.md` — Code Blueprints (lines 54–148)

The key blueprint section is reproduced below. Note that lines 150–234 contain `AudioOrchestrator` which is OUT OF SCOPE for this task.

```typescript
// FROM docs/frontend-spec.md lines 57–148:

export interface SpeechToTextProvider {
  start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>;
  stop(): Promise<void>;
}

// 1. Deepgram WebSocket Provider
export class DeepgramSpeechProvider implements SpeechToTextProvider {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(private apiKey: string) {}

  public async start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    // Open a direct streaming connection to Deepgram's Nova model
    this.socket = new WebSocket(
      'wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000',
      ['token', this.apiKey]
    );

    this.socket.onopen = () => {
      console.log('Deepgram WebSocket connection established.');
      
      // Capture microphone audio and stream raw chunks to the WebSocket
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(event.data);
        }
      };
      this.mediaRecorder.start(250); // Stream in 250ms small audio intervals
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      const isFinal = data.is_final;

      if (isFinal && transcript && transcript.trim().length > 0) {
        onTextCaptured(transcript.trim());
      }
    };

    this.socket.onerror = (err) => console.error('Deepgram Socket Error:', err);
  }

  public async stop(): Promise<void> {
    this.mediaRecorder?.stop();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// 2. Browser Web Speech Provider (Fallback)
export class WebSpeechProvider implements SpeechToTextProvider {
  private recognition: SpeechRecognition | null = null;
  private isRunning = false;

  public async start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void> {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'id-ID';
    this.isRunning = true;

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript.trim().length > 0) {
        onTextCaptured(finalTranscript.trim());
      }
    };

    this.recognition.onend = () => {
      if (this.isRunning) this.recognition?.start(); // Auto-restart on silent timeouts
    };

    this.recognition.start();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.recognition?.stop();
  }
}
```

### 2. `packages/frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

### 3. `.ai/context.md`

(See "Project Context" section above — relevant parts already captured.)

### 4. `packages/frontend/next-env.d.ts`

```typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";
// NOTE: This file should not be edited
```

## Report Path

`/home/ltanaka/github/translation-service/.ai/tasks/1718914000-p4b-asr/implementation-report.md`

## Verification Commands

1. **TypeScript compilation**:
   ```
   cd /home/ltanaka/github/translation-service/packages/frontend && npx tsc --noEmit
   ```
   Expected: zero errors.

2. **Import audit** (no React/Next.js imports):
   ```
   cd /home/ltanaka/github/translation-service && grep -rn "from 'react'\|from 'next'\|from 'next/" packages/frontend/src/services/speech/
   ```
   Expected: zero matches.

3. **Export audit** (no default exports):
   ```
   cd /home/ltanaka/github/translation-service && grep -rn "export default" packages/frontend/src/services/speech/
   ```
   Expected: zero matches.

4. **Interface conformance check**: Both `DeepgramSpeechProvider` and `WebSpeechProvider` must use `implements SpeechToTextProvider`.

## Constraints and Non-Goals

### In Scope
- `packages/frontend/src/services/speech/SpeechToTextProvider.ts` — TypeScript interface
- `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` — Deepgram WebSocket adapter
- `packages/frontend/src/services/speech/WebSpeechProvider.ts` — Web Speech API adapter

### Explicitly Out of Scope
- `AudioOrchestrator.ts` (Phase 4C)
- `useAudioCapture` React hook (Phase 4D)
- `/speaker` page UI (Phase 4E)
- IndexedDB audio backup logic
- Screen Wake Lock API
- Deepgram API key management or environment variable reading — `apiKey` is a plain constructor parameter
- Supabase Realtime integration
- Any translation/broadcast pipeline logic

### Constraints
- All TypeScript, strict mode compatible
- Named exports only (no `export default`)
- No React or Next.js dependencies — pure TypeScript service classes
- Browser-only APIs are fine (WebSocket, MediaRecorder, SpeechRecognition)
- Follow code blueprints from frontend-spec.md closely; deviations only for strict-mode TS fixes
- `stream` parameter consumed read-only; providers never stop stream tracks

### Key Design Decisions
- Deepgram auth uses WebSocket subprotocol `['token', apiKey]`
- WebSocket URL: `wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000`
- WebSpeech: language `id-ID`, continuous mode, interimResults false, auto-restart on end
- For `window.webkitSpeechRecognition` type issue: add `declare global { interface Window { webkitSpeechRecognition: typeof SpeechRecognition } }` or use type assertion
- MediaRecorder mimeType: `audio/webm` as specified (browser compat handled later by orchestrator)

## Stop Conditions

Stop and report back to orchestrator if:
- Requirements are unclear, destructive, security-sensitive, or conflict with the task spec
- Deepgram WebSocket subprotocol auth method `['token', apiKey]` is confirmed incorrect (and no alternative is specified)
- TypeScript compilation (`tsc --noEmit`) produces errors that can't be resolved within the scope of this task
- Any file outside the three target files needs modification beyond what's specified

## Explicit Instructions

1. Create exactly three files under `packages/frontend/src/services/speech/`:
   - `SpeechToTextProvider.ts` — interface
   - `DeepgramSpeechProvider.ts` — Deepgram WebSocket adapter
   - `WebSpeechProvider.ts` — Web Speech API fallback
2. Follow the code blueprints from `docs/frontend-spec.md` lines 57–148 closely, adapting only for strict-mode TypeScript compatibility.
3. For `window.webkitSpeechRecognition`, add a type declaration (e.g., `declare global { interface Window { webkitSpeechRecognition: typeof SpeechRecognition } }` inline in WebSpeechProvider.ts) or use a type assertion.
4. All exports must be named (no `export default`).
5. No imports from `react`, `next`, or `next/*`.
6. The `stream` parameter must be consumed read-only — do not call `stream.getTracks()` or `track.stop()`.
7. `start()` must not resolve before the underlying connection/capture is fully initialized.
8. Log errors via `console.error`, never throw from event handlers.
9. After all three files are created, run verification commands.
10. Write the implementation report at `/home/ltanaka/github/translation-service/.ai/tasks/1718914000-p4b-asr/implementation-report.md`.
11. Do NOT commit, amend, or push any changes.
12. Do NOT write test files.
13. Do NOT modify files outside the three target files (except this handoff file and the implementation report).
