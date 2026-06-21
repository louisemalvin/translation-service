# Phase 4C: Audio Orchestrator, IndexedDB & Wake Lock — Implementation Report

## Outcome

Both files have been created and the implementation satisfies all acceptance criteria. TypeScript compilation (`tsc --noEmit`) passes with zero errors. The blueprint bug (duplicate `initIndexedDB()` method and un-awaited init before backup recording) has been fixed.

## Files Changed

| File | Action |
|------|--------|
| `packages/frontend/src/lib/wakeLock.ts` | **Created** — Wake Lock helper with `requestWakeLock()` and `releaseWakeLock()` named exports |
| `packages/frontend/src/services/speech/AudioOrchestrator.ts` | **Created** — Central orchestrator class managing mic stream, ASR provider, IndexedDB backup, and wake lock lifecycle |

No existing files were modified. (Note: `packages/frontend/src/app/layout.tsx` has a pre-existing unstaged change unrelated to this task.)

## Decisions

### 1. WakeLockSentinel type — DOM lib used
TypeScript 5.x with `"lib": ["dom", ...]` includes `WakeLockSentinel` and `WakeLock` in its DOM type definitions. No local interface declaration was needed — `tsc --noEmit` passes without errors. This follows the `tsconfig.json` lib configuration.

### 2. Import path for wakeLock
`AudioOrchestrator.ts` is at `src/services/speech/`, `wakeLock.ts` is at `src/lib/`. The relative import `../../lib/wakeLock` correctly resolves.

### 3. initIndexedDB — exactly one method
The blueprint bug (duplicate `initIndexedDB()` on lines 211–217 and 218–233 of `frontend-spec.md`) is fixed: there is exactly one `initIndexedDB()` method in the class body, and it is fully awaited before `startBackupRecording()` is called.

### 4. Sequencing in `start()`
The exact ordered pipeline from the task spec:
1. `getUserMedia({ audio: true })`
2. `this.isRunning = true`
3. `await requestWakeLock()`
4. `await this.initIndexedDB()` — **fully awaited** before next step
5. `await this.provider.start(...)`
6. `this.startBackupRecording()` — fire-and-forget

### 5. Wake lock sentinel lifecycle
The module-level `wakeLockSentinel` variable is:
- Set on `requestWakeLock()` success
- Nullified via `onrelease` event handler (handles OS-triggered release)
- Nullified via `.then()` callback in `releaseWakeLock()` (handles manual release)
- Errors are caught and logged (no throw)

## Verification

### TypeScript Compilation
```
npx tsc --noEmit           → exit code 0, zero errors
```
Run from `packages/frontend/`.

### Acceptance Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `AudioOrchestrator` class with `start()` and `stop()` | ✅ |
| 2 | Constructor selects correct provider (`DeepgramSpeechProvider` / `WebSpeechProvider`) | ✅ |
| 3 | `start()` performs full pipeline in correct order | ✅ |
| 4 | `initIndexedDB()` resolves before `startBackupRecording()` | ✅ (line 30 awaited, line 32 fire-and-forget) |
| 5 | `initIndexedDB()` defined exactly once (no duplicate) | ✅ (definition at line 53, call at line 30) |
| 6 | IndexedDB: `'SermonAudioBackup'`, `'audio_chunks'`, `keyPath: 'timestamp'` | ✅ |
| 7 | Backup MediaRecorder chunks every 5000ms | ✅ (`this.backupRecorder.start(5000)`) |
| 8 | `stop()` tears down in order: provider.stop → backupRecorder.stop → track.stop → releaseWakeLock → db.close | ✅ |
| 9 | `wakeLock.ts` exports `requestWakeLock()` and `releaseWakeLock()` | ✅ (named exports) |
| 10 | `requestWakeLock()` no-op without Wake Lock API | ✅ (`'wakeLock' in navigator` guard) |
| 11 | `releaseWakeLock()` no-op when no lock held | ✅ (null check on `wakeLockSentinel`) |
| 12 | TypeScript compiles clean (`tsc --noEmit`) | ✅ |
| 13 | Only two files created/modified | ✅ |
| 14 | Named exports only (no `export default`) | ✅ |
| 15 | Class, not React hook | ✅ |
| 16 | Blueprint deduplication (exactly one `initIndexedDB`) | ✅ |
| 17 | Constructor stores all parameters | ✅ |
| 18 | Wake lock sentinel lifecycle managed correctly | ✅ |
| 19 | `ondataavailable` null-checks `this.db` before transaction | ✅ (`if (event.data.size > 0 && this.db)`) |
| 20 | `isRunning` flag set true on start, false on stop | ✅ |

## Known Issues

- None. All acceptance criteria are satisfied. The pre-existing change in `packages/frontend/src/app/layout.tsx` is unrelated to this task.

## Open Issues / Follow-up

- The `useAudioCapture` React hook (Phase 4D) will instantiate `AudioOrchestrator`.
- The `/speaker` page (Phase 4E) will consume the hook.
