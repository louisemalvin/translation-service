# Phase 4B: ASR Provider Interface & Adapters — Planning Handoff

- **User Intent**: Implement the modular Speech-to-Text provider interface and two concrete adapters: Deepgram (WebSocket streaming) and WebSpeech (browser-native fallback). These are the ASR engines that capture spoken Indonesian and return transcribed text.

- **Conversation-Derived Context**: Unit 4B is part of Phase 4's 5-unit decomposition. It has no dependencies on other Phase 4 units. The files go in `packages/frontend/src/services/speech/`. The frontend-spec.md contains detailed code blueprints for both providers and the interface.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-4-speaker-pwa.md` Step 2 — ASR Interface & Adapters specification
  - `docs/frontend-spec.md` Section "Modular Speech-to-Text Architecture" — complete code blueprints for SpeechToTextProvider interface, DeepgramSpeechProvider, and WebSpeechProvider
  - `.ai/context.md` — TypeScript strict mode, named exports, camelCase

- **Proposed Task Shape**: Single-unit task: create the provider interface and two adapters. Three files total.

- **Assigned Output Path(s)**: `.ai/tasks/1718914000-p4b-asr/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `packages/frontend/src/services/speech/SpeechToTextProvider.ts` (TypeScript interface), `DeepgramSpeechProvider.ts` (WebSocket to wss://api.deepgram.com, MediaRecorder 250ms chunks, onTextCaptured callback), `WebSpeechProvider.ts` (browser SpeechRecognition API, Indonesian lang id-ID, continuous mode, auto-restart on silent timeouts)
  - OUT OF SCOPE: AudioOrchestrator (4C), useAudioCapture hook (4D), /speaker page (4E), IndexedDB, wake lock, Deepgram API key management (expect apiKey in constructor)

- **Constraints**:
  - All TypeScript, strict mode compatible
  - Named exports (not default)
  - Deepgram provider: WebSocket to wss://api.deepgram.com/v1/listen?language=id&model=nova-2&encoding=linear16&sample_rate=16000, auth via ['token', apiKey] protocol
  - WebSpeech provider: language id-ID, continuous true, interimResults false, auto-restart on 'end' event while isRunning
  - Follow the code blueprints from frontend-spec.md closely
  - No React dependencies — these are pure TypeScript service classes
  - Browser-only APIs are fine (WebSocket, MediaRecorder, SpeechRecognition) — they'll only run client-side

- **Acceptance Signals**:
  1. `SpeechToTextProvider.ts` exports a clean interface with `start(stream: MediaStream, onTextCaptured: (text: string) => void): Promise<void>` and `stop(): Promise<void>`
  2. `DeepgramSpeechProvider.ts` implements the interface, opens correct WebSocket URL, sends audio chunks at 250ms intervals, parses onmessage for is_final transcripts
  3. `WebSpeechProvider.ts` implements the interface, uses SpeechRecognition with lang id-ID, continuous mode, auto-restart on end
  4. All three files compile with `tsc --noEmit` (via `pnpm --filter shared build && cd packages/frontend && npx tsc --noEmit`)
  5. No React or Next.js imports in any file

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the three files. Validator confirms acceptance criteria. All Phase 4 units committed together after 4E.

- **Open Questions / Stop Conditions**:
  - Deepgram uses WebSocket with subprotocol ['token', apiKey] — confirm this is the correct auth method for Deepgram's browser SDK
  - WebSpeechProvider uses `window.SpeechRecognition || window.webkitSpeechRecognition` — ensure TypeScript types exist or add a type declaration
