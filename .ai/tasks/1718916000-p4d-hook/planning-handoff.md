# Phase 4D: useAudioCapture Hook & Supabase Client — Planning Handoff

- **User Intent**: Implement the React hook `useAudioCapture` that acts as the single boundary between the UI and the audio capture/translation/broadcast pipeline. Also create the Supabase client initialization module. The hook manages: ASR text capture → Edge Function translation → sliding history → Realtime WebSocket broadcast.

- **Conversation-Derived Context**: Unit 4D depends on 4C (AudioOrchestrator). The hook instantiates AudioOrchestrator and wires it to the translation pipeline. The code blueprint is in frontend-spec.md lines 246-365. The hook uses the Supabase JS client for broadcasting, and Edge Function HTTP calls for translation.

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-4-speaker-pwa.md` Step 4 — useAudioCapture hook specification
  - `docs/frontend-spec.md` Section "Clean React UI Hook Abstraction" — complete code blueprint
  - `docs/realtime-broadcast.md` — WebSocket channel config, broadcast payload schema
  - `packages/frontend/src/services/speech/AudioOrchestrator.ts` (from 4C)
  - Phase 3 output: `supabase/functions/translate/index.ts`
  - `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

- **Proposed Task Shape**: Single-unit task: create supabase client lib and useAudioCapture hook. Two files total.

- **Assigned Output Path(s)**: `.ai/tasks/1718916000-p4d-hook/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `packages/frontend/src/lib/supabaseClient.ts` (createClient with env vars), `packages/frontend/src/hooks/useAudioCapture.ts` (React hook with start/stop, translation pipeline, broadcast)
  - OUT OF SCOPE: /speaker page (4E), TTS (Phase 5), viewer page (Phase 5), any UI components

- **Constraints**:
  - Supabase client: `import { createClient } from '@supabase/supabase-js'`, reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Hook signature: `useAudioCapture(sermonId: string): UseAudioCaptureResult`
  - UseAudioCaptureResult: { isListening, start, stop, latestTranscribedText, error }
  - PIN from sessionStorage: `sessionStorage.getItem('speaker_pin')`
  - ASR provider from localStorage: `localStorage.getItem('asr_provider') || 'deepgram'`
  - Deepgram key from localStorage: `localStorage.getItem('deepgram_api_key') || ''`
  - Edge Function URL: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate`
  - History: sliding last 3 segments, stored in useRef
  - Sequence: incrementing counter in useRef
  - Channel: `sermon-live` Supabase Realtime channel
  - Broadcast payload: { sequence_number, raw_text, translated_text, timestamp }
  - Cleanup on unmount: stop orchestrator, unsubscribe channel
  - Must install `@supabase/supabase-js` as a frontend dependency (add to packages/frontend/package.json)
  - Follow the code blueprint closely

- **Acceptance Signals**:
  1. `supabaseClient.ts` creates and exports a configured Supabase client
  2. `useAudioCapture` hook has correct interface and return type
  3. `start()` reads PIN from sessionStorage, provider choice from localStorage
  4. `start()` creates Supabase channel, subscribes, instantiates AudioOrchestrator
  5. On text captured: calls translate Edge Function with x-admin-pin header
  6. On translation success: updates history (max 3), broadcasts to channel
  7. On translation error: sets error state, does NOT crash
  8. `stop()` tears down orchestrator and unsubscribes channel
  9. Cleanup useEffect handles unmount teardown
  10. `tsc --noEmit` compiles clean
  11. `pnpm install` succeeds (including @supabase/supabase-js)

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the two files + adds dependency. Validator confirms acceptance criteria. All Phase 4 units committed together after 4E.

- **Open Questions / Stop Conditions**:
  - The `@supabase/supabase-js` package needs to be installed. The task-planner should specify the exact version to use.
  - Stop if `@supabase/supabase-js` cannot be installed.
