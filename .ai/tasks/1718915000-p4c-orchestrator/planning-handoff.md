# Phase 4C: Audio Orchestrator, IndexedDB & Wake Lock — Planning Handoff

- **User Intent**: Implement the central AudioOrchestrator class that manages the full audio capture pipeline: microphone stream acquisition, ASR provider selection and launch, IndexedDB backup audio recording in 5-second chunks, and screen wake lock to prevent mobile sleep during sermons.

- **Conversation-Derived Context**: Unit 4C depends on 4A (wake lock code exists in frontend-spec.md) and 4B (ASR providers are created). The AudioOrchestrator is instantiated by the useAudioCapture hook (4D) and consumed by the /speaker page (4E). The code blueprint is in frontend-spec.md lines 150-234, but has a known bug: `initIndexedDB()` is called before it has resolved when `startBackupRecording()` begins. The implementation must fix this by awaiting `initIndexedDB()`.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-4-speaker-pwa.md` Step 3 — Audio Orchestrator specification
  - `docs/frontend-spec.md` Section "PWA Keep-Alive & Wake Lock" (wake lock functions) and section "Modular Speech-to-Text Architecture" lines 150-234 (AudioOrchestrator blueprint)
  - `packages/frontend/src/services/speech/SpeechToTextProvider.ts` (from 4B)
  - `packages/frontend/src/services/speech/DeepgramSpeechProvider.ts` (from 4B)
  - `packages/frontend/src/services/speech/WebSpeechProvider.ts` (from 4B)

- **Proposed Task Shape**: Single-unit task: create AudioOrchestrator.ts and wake lock helper. Two files total.

- **Assigned Output Path(s)**: `.ai/tasks/1718915000-p4c-orchestrator/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `packages/frontend/src/services/speech/AudioOrchestrator.ts` (class managing stream capture, ASR provider selection, IndexedDB backup recording, wake lock lifecycle), `packages/frontend/src/lib/wakeLock.ts` (requestWakeLock / releaseWakeLock functions)
  - OUT OF SCOPE: useAudioCapture hook (4D), /speaker page (4E), Supabase/translation integration, Deepgram API key storage (expect it in constructor config)

- **Constraints**:
  - TypeScript strict mode, named exports
  - Constructor takes: sermonId, providerType ('deepgram' | 'webspeech'), config { apiKey? }, onTextCaptured callback
  - IndexedDB database name: `SermonAudioBackup`, object store: `audio_chunks`, keyPath: `timestamp`
  - MediaRecorder chunks stored every 5000ms (5 seconds)
  - Wake lock functions from frontend-spec.md: requestWakeLock() and releaseWakeLock(), use `navigator.wakeLock.request('screen')`
  - FIX the blueprint bug: `start()` must await `initIndexedDB()` BEFORE calling `startBackupRecording()`
  - `stop()` must: stop provider, stop backup recorder, stop media tracks, release wake lock
  - Must be a single class, not a React hook

- **Acceptance Signals**:
  1. `AudioOrchestrator.ts` exports a class with `start()` and `stop()` methods
  2. Constructor selects correct provider based on `providerType` parameter
  3. `start()` calls getUserMedia({ audio: true }), initializes IndexedDB, starts ASR provider, starts backup recorder, requests wake lock
  4. `stop()` properly tears down: stops provider, stops MediaRecorder, stops tracks, releases wake lock
  5. IndexedDB uses `SermonAudioBackup` with `audio_chunks` object store
  6. Backup MediaRecorder chunks every 5000ms
  7. `initIndexedDB()` resolves BEFORE `startBackupRecording()` is called
  8. `wakeLock.ts` exports requestWakeLock() and releaseWakeLock() with proper WakeLockSentinel management
  9. TypeScript compiles clean with `tsc --noEmit`

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the two files. Validator confirms acceptance criteria. All Phase 4 units committed together after 4E.

- **Open Questions / Stop Conditions**:
  - The frontend-spec.md blueprint has a duplicate `initIndexedDB()` method on lines 211-233 — the implementation must deduplicate and fix the ordering
  - Stop if tsc compilation fails with errors not related to browser API types
