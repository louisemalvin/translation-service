# Implementation Report: Phase 4B — ASR Provider Interface & Adapters

## Outcome

All three target files for the Speech-to-Text (ASR) architecture have been successfully created and configured in `packages/frontend/src/services/speech/`. The implementation aligns completely with the blueprints and constraints outlined in the task specification, compiling cleanly under strict mode TypeScript.

## Files Changed

The following new files were created:
1. [SpeechToTextProvider.ts](file:///home/ltanaka/github/translation-service/packages/frontend/src/services/speech/SpeechToTextProvider.ts) — Defines the ASR provider interface contract (`SpeechToTextProvider`).
2. [DeepgramSpeechProvider.ts](file:///home/ltanaka/github/translation-service/packages/frontend/src/services/speech/DeepgramSpeechProvider.ts) — Implements `SpeechToTextProvider` to interface with the Deepgram Nova-2 WebSocket API.
3. [WebSpeechProvider.ts](file:///home/ltanaka/github/translation-service/packages/frontend/src/services/speech/WebSpeechProvider.ts) — Implements `SpeechToTextProvider` using the browser's native `SpeechRecognition` API as a fallback.

## Decisions

### 1. Promise-based Initialization in `start()`
Per the requirement that `start()` must not resolve before the underlying connection/capture is fully initialized:
- In `DeepgramSpeechProvider`, the Promise resolves inside the `onopen` callback after the `MediaRecorder` has successfully started recording.
- In `WebSpeechProvider`, the Promise resolves inside the `onstart` callback.
- Error handling has been integrated into the initialization phase so that if initialization fails (e.g. socket fails to open, or browser SpeechRecognition is blocked), the promise is rejected, allowing the orchestrator to catch and fallback correctly.

### 2. Strict-mode TypeScript declarations for Web Speech API
To ensure WebSpeechProvider compiles cleanly under strict mode `tsc --noEmit` without any ambient type dependencies, complete inline type declarations were written for:
- `SpeechRecognition`
- `SpeechRecognitionEvent`
- `SpeechRecognitionResultList`
- `SpeechRecognitionResult`
- `SpeechRecognitionAlternative`
- `SpeechRecognitionErrorEvent`
- `SpeechRecognitionConstructor`

And the `Window` interface was extended via `declare global` to include `webkitSpeechRecognition`.

### 3. Graceful event-handler error handling
Event handlers catch errors internally and log them using `console.error` without throwing, preventing uncaught runtime crashes.

### 4. Read-only stream consumption
Neither provider stops the tracks of the passed `MediaStream`, keeping the lifecycle management of the audio stream under the control of the orchestrator.

## Verification

The following validation checks were successfully performed:

1. **TypeScript compilation**:
   Command: `cd packages/frontend && npx tsc --noEmit`
   Result: Output was clean with zero compilation errors.

2. **Import audit (no React/Next.js coupling)**:
   Command: `grep -rn "from 'react'\|from 'next'\|from 'next/" packages/frontend/src/services/speech/`
   Result: Zero matches (exit code 1).

3. **Export audit (named exports only)**:
   Command: `grep -rn "export default" packages/frontend/src/services/speech/`
   Result: Zero matches (exit code 1).

4. **Interface conformance**:
   Both `DeepgramSpeechProvider` and `WebSpeechProvider` successfully implement `SpeechToTextProvider`.
