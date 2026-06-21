# Phase 4C: Audio Orchestrator, IndexedDB & Wake Lock — Task Specification

## Source Artifacts / Handoff Context

- **Planning handoff**: `.ai/tasks/1718915000-p4c-orchestrator/planning-handoff.md` (canonical)
- **Phase 4 implementation plan**: `docs/implementation-plans/phase-4-speaker-pwa.md` Step 3 — Audio Orchestrator specification
- **Frontend spec blueprint**: `docs/frontend-spec.md`
  - "PWA Keep-Alive & Wake Lock" section (wake lock functions)
  - "Modular Speech-to-Text Architecture" section lines 150–234 (AudioOrchestrator blueprint)
- **Phase 4B providers** (already implemented, read for conventions):
  - `packages/frontend/src/services/speech/SpeechToTextProvider.ts`
  - `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts`
  - `packages/frontend/src/services/speech/WebSpeechProvider.ts`

## Scope

This is a **single-unit task** creating exactly two files:

| # | File | Purpose |
|---|------|---------|
| 1 | `packages/frontend/src/lib/wakeLock.ts` | Wake Lock helper: `requestWakeLock()` and `releaseWakeLock()` |
| 2 | `packages/frontend/src/services/speech/AudioOrchestrator.ts` | Central orchestrator class managing mic stream, ASR provider, IndexedDB backup recording, and wake lock lifecycle |

The `AudioOrchestrator` is instantiated by the `useAudioCapture` hook (Phase 4D) and consumed by the `/speaker` page (Phase 4E). These downstream consumers are **out of scope** for this unit.

## Non-Goals

- The `useAudioCapture` React hook (Phase 4D)
- The `/speaker` page UI (Phase 4E)
- Supabase / translation integration
- Deepgram API key storage (provided as constructor config)
- Service worker / PWA manifest configuration
- Any modifications to existing Phase 4B provider files
- The "Download Backup Audio" / "Clear Cache" UI actions (those belong in Phase 4E)

## Execution

**Pipeline**: implementer → validator

### Implementer

Create both files according to the detailed requirements below.

### Validator

Verify all acceptance criteria. Run `tsc --noEmit` in the frontend package. Confirm the blueprint bugs are resolved.

---

## Detailed Requirements

### File 1: `packages/frontend/src/lib/wakeLock.ts`

Create this directory if it does not exist.

**Exports** (both named exports):

- `requestWakeLock(): Promise<void>`
- `releaseWakeLock(): void`

**Implementation**:

- Use a module-level `wakeLockSentinel: WakeLockSentinel | null = null` variable.
- `requestWakeLock()`:
  1. Guard: if `'wakeLock'` is not in `navigator`, return early (no-op; console-log availability gap).
  2. Call `navigator.wakeLock.request('screen')` and store the result in `wakeLockSentinel`.
  3. Attach a `release` event listener on the sentinel that sets `wakeLockSentinel = null` (the OS may release the lock; the module variable must stay accurate).
  4. Catch and `console.warn` any errors.
- `releaseWakeLock()`:
  1. If `wakeLockSentinel` is non-null, call `wakeLockSentinel.release().then(() => { wakeLockSentinel = null; })`.
  2. Do not throw; handle errors with `console.error`.

**TypeScript notes**: The `WakeLockSentinel` type may not be in the default `lib`. Declare the interface at the top of the file if needed:

```typescript
interface WakeLockSentinel {
  released: boolean;
  type: 'screen';
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinel, ev: Event) => any) | null;
}
```

Since `tsconfig.json` has `"lib": ["dom", "dom.iterable", "esnext"]`, the `WakeLockSentinel` type may already be available. If `tsc --noEmit` reports it as missing, add the declaration.

**Edge cases**:
- Browser without Wake Lock API → silent no-op in `requestWakeLock()`, no crash in `releaseWakeLock()`.
- Wake lock released by OS → module variable is nullified via the `release` event listener so `releaseWakeLock()` does not double-release.

---

### File 2: `packages/frontend/src/services/speech/AudioOrchestrator.ts`

Place alongside the existing provider files.

**Exports** (named export):

- `AudioOrchestrator` class

**Constructor signature**:

```typescript
constructor(
  sermonId: string,
  providerType: 'deepgram' | 'webspeech',
  config: { apiKey?: string },
  onTextCaptured: (text: string) => void
)
```

Constructor behaviour:
- Select and instantiate the ASR provider based on `providerType`:
  - `'deepgram'` → `new DeepgramSpeechProvider(config.apiKey || '')`
  - `'webspeech'` → `new WebSpeechProvider()`
- Store `sermonId`, `onTextCaptured`, and the provider instance as private fields.

**Private fields**:

| Field | Type | Notes |
|-------|------|-------|
| `stream` | `MediaStream \| null` | Acquired via `getUserMedia` |
| `backupRecorder` | `MediaRecorder \| null` | 5-second chunk recorder |
| `isRunning` | `boolean` | Set to `true` on start, `false` on stop |
| `db` | `IDBDatabase \| null` | IndexedDB connection handle |
| `provider` | `SpeechToTextProvider` | Selected ASR provider |

**Public method — `start(): Promise<void>`**:

The **exact sequencing** of this method is a hard constraint:

1. `this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })`
2. `this.isRunning = true`
3. `await requestWakeLock()` (imported from `../lib/wakeLock`)
4. `await this.initIndexedDB()` — **must fully resolve before step 5**
5. `await this.provider.start(this.stream, this.onTextCaptured)`
6. `this.startBackupRecording()` — non-awaited (fire-and-forget; MediaRecorder drives itself)

**CRITICAL BUG FIX**: The blueprint in `frontend-spec.md` has a duplicate, malformed `initIndexedDB()` method (lines 211–217 are a truncated copy; lines 218–233 are a second, complete copy). The implementation must have **exactly one** correct `initIndexedDB()` method. Additionally, step 4 (`initIndexedDB`) must be **fully awaited** before step 6 (`startBackupRecording`) is called. This ensures `this.db` is non-null when the `MediaRecorder.ondataavailable` handler first fires.

**Public method — `stop(): Promise<void>`**:

1. `this.isRunning = false`
2. `await this.provider.stop()`
3. Stop the backup `MediaRecorder` if it exists and its state is not `'inactive'`:
   ```typescript
   if (this.backupRecorder && this.backupRecorder.state !== 'inactive') {
     this.backupRecorder.stop();
   }
   this.backupRecorder = null;
   ```
4. Stop all media tracks:
   ```typescript
   this.stream?.getTracks().forEach(track => track.stop());
   this.stream = null;
   ```
5. Call `releaseWakeLock()` (imported from `../lib/wakeLock`)
6. Close the IndexedDB connection:
   ```typescript
   this.db?.close();
   this.db = null;
   ```

**Private method — `initIndexedDB(): Promise<void>`**:

- Database name: `'SermonAudioBackup'`
- Version: `1`
- Object store: `'audio_chunks'` with `keyPath: 'timestamp'`
- Returns a `Promise<void>` that resolves when the database is open and `this.db` is set.
- Uses the standard `indexedDB.open()` pattern with `onupgradeneeded`, `onsuccess`, and `onerror`.
- On `onupgradeneeded`: create the `'audio_chunks'` store if it does not already exist.
- On `onsuccess`: set `this.db = request.result` and `resolve()`.
- On `onerror`: `reject(request.error)`.

**Private method — `startBackupRecording(): void`**:

- Creates a `new MediaRecorder(this.stream!)` (stream is guaranteed non-null here since `start()` sets it first).
- `ondataavailable` handler (async):
  - Guard: `event.data.size > 0 && this.db` (null-check on `this.db`).
  - Open a `readwrite` transaction on `'audio_chunks'`.
  - `store.put({ sermon_id: this.sermonId, timestamp: Date.now(), blob: event.data })`.
  - Note: `put` returns an `IDBRequest`; the handler may use `await` but does not need to block subsequent chunks.
- Call `this.backupRecorder.start(5000)` — chunks every **5000ms** (5 seconds).

**Edge cases**:

- `getUserMedia` rejection in `start()`: the error propagates naturally; the caller (`useAudioCapture`, Phase 4D) handles it.
- `initIndexedDB` failure in `start()`: the error propagates; backup recording is never started, but the ASR provider may still be running (the `start()` method will have rejected at step 4 before reaching step 5). The caller is responsible for cleanup.
- `stop()` called without a prior `start()`: all guards (`?.`, null checks) handle this gracefully — no crashes.
- `stop()` called twice: all guards handle this gracefully.
- Deepgram `apiKey` is empty string: handled by the provider constructor downstream; the orchestrator passes through whatever it receives.

**Imports**:

```typescript
import { SpeechToTextProvider } from './SpeechToTextProvider';
import { DeepgramSpeechProvider } from './DeepgramSpeechProvider';
import { WebSpeechProvider } from './WebSpeechProvider';
import { requestWakeLock, releaseWakeLock } from '../../lib/wakeLock';
```

(Adjust the relative path to `wakeLock` to `../lib/wakeLock` — the orchestrator is at `src/services/speech/AudioOrchestrator.ts`, wakeLock is at `src/lib/wakeLock.ts`.)

---

## Testable Acceptance Criteria

1. **AudioOrchestrator exports a class** with `start()` and `stop()` methods.  
2. **Constructor selects correct provider**: instantiates `DeepgramSpeechProvider` for `'deepgram'`, `WebSpeechProvider` for `'webspeech'`.  
3. **`start()` performs the full pipeline in correct order**: getUserMedia → wake lock → initIndexedDB → provider.start → startBackupRecording.  
4. **IndexedDB init resolves before backup recording starts**: verify that `this.db` is non-null when `startBackupRecording()` is called (achieved by the `await this.initIndexedDB()` before `this.startBackupRecording()`).  
5. **`initIndexedDB()` is defined exactly once** (no duplicate method — the blueprint bug is fixed).  
6. **IndexedDB uses correct names**: database `'SermonAudioBackup'`, store `'audio_chunks'`, keyPath `'timestamp'`.  
7. **Backup MediaRecorder chunks every 5000ms**: `this.backupRecorder.start(5000)` is called.  
8. **`stop()` tears down everything in order**: provider.stop → backupRecorder.stop → track.stop → releaseWakeLock → db.close.  
9. **`wakeLock.ts` exports `requestWakeLock()` and `releaseWakeLock()`** with proper `WakeLockSentinel` management.  
10. **`requestWakeLock()` is a no-op** (no crash, no throw) in browsers without the Wake Lock API.  
11. **`releaseWakeLock()` is a no-op** when no lock is held.  
12. **TypeScript compiles clean**: `tsc --noEmit` passes with zero errors.  
13. **Only two files are created/modified**: `wakeLock.ts` and `AudioOrchestrator.ts`. No changes to existing provider files.

### Test File Paths

- `packages/frontend/src/lib/wakeLock.ts`
- `packages/frontend/src/services/speech/AudioOrchestrator.ts`

---

## Inspectable Acceptance Criteria

14. **Named exports only** — no `export default` in either file.  
15. **Class, not a React hook** — `AudioOrchestrator` is a plain TypeScript class with no React dependencies.  
16. **Blueprint deduplication** — exactly one `initIndexedDB()` method exists in the class body.  
17. **Constructor stores all parameters** — `sermonId`, `providerType`, `config`, and `onTextCaptured` are captured and used correctly.  
18. **Wake lock sentinel lifecycle** — the module-level `wakeLockSentinel` is set on request, nullified on release (both manual and OS-triggered).  
19. **IndexedDB `ondataavailable` handler null-checks `this.db`** before opening a transaction.  
20. **`isRunning` flag is set to `true` on start, `false` on stop** — the `stop()` method sets it even if some teardown steps throw.

---

## Relevant Files

| File | Role |
|------|------|
| `packages/frontend/src/services/speech/SpeechToTextProvider.ts` | Interface implemented by providers, imported by orchestrator |
| `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` | Deepgram ASR provider (already built, Phase 4B) |
| `packages/frontend/src/services/speech/WebSpeechProvider.ts` | Web Speech fallback provider (already built, Phase 4B) |
| `packages/frontend/tsconfig.json` | TypeScript config: strict mode, `dom` lib, `noEmit` |
| `docs/frontend-spec.md` lines 150–234 | Blueprint (with known bugs to fix) |

---

## Validation Plan

1. **Static analysis**: Run `npx tsc --noEmit` from `packages/frontend/`. Must pass with zero errors.
2. **File count**: Confirm exactly two new files exist. Confirm zero changes to existing provider files.
3. **Export inspection**: Verify both files use named exports. Verify `AudioOrchestrator` is a class (not a function or hook).
4. **Blueprint bug fix verification**: 
   - Confirm exactly one `initIndexedDB()` method definition exists (no duplicates).
   - Confirm `start()` calls `await this.initIndexedDB()` on a line **before** the line that calls `this.startBackupRecording()`.
5. **IndexedDB name/structure**: Confirm database name `'SermonAudioBackup'`, store name `'audio_chunks'`, keyPath `'timestamp'`.
6. **Chunk interval**: Confirm `this.backupRecorder.start(5000)` is called.
7. **Constructor provider selection**: Confirm the constructor instantiates the correct provider class based on `providerType`.
8. **Wake lock**: Confirm `requestWakeLock()` and `releaseWakeLock()` match the frontend-spec.md pattern with `WakeLockSentinel` lifecycle management.
9. **`stop()` completeness**: Confirm stop() calls: provider.stop, backupRecorder.stop (with state guard), track.stop, releaseWakeLock, db.close.

---

## Open Questions

1. **`WakeLockSentinel` type availability**: The `tsconfig.json` includes `"lib": ["dom", "dom.iterable", "esnext"]`. The `WakeLockSentinel` interface may or may not be included in the current TypeScript DOM lib version. If `tsc --noEmit` fails with a `WakeLockSentinel` type error, the implementer should add a local interface declaration in `wakeLock.ts`. This is an implementation-local decision.

2. **Stop-if-blocked condition**: Per the planning handoff, stop if `tsc` compilation fails with errors **not** related to browser API types. Browser API type gaps (like `WakeLockSentinel`) are acceptable to work around; structural TypeScript errors (missing imports, type mismatches) are not.
