# Phase 4D: useAudioCapture Hook & Supabase Client — Implementation Report

## Outcome

All three deliverables implemented and verified:

1. **`packages/frontend/src/lib/supabaseClient.ts`** — Created and exported a configured Supabase client via `createClient()` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.
2. **`packages/frontend/src/hooks/useAudioCapture.ts`** — Created the React hook with the full translation pipeline: ASR capture → Edge Function translation → sliding 3-segment history → Supabase Realtime broadcast.
3. **`packages/frontend/package.json`** — Added `"@supabase/supabase-js": "^2.39.0"` to dependencies.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/lib/supabaseClient.ts` | **Create** | Supabase client singleton using `createClient` from `@supabase/supabase-js` |
| `packages/frontend/src/hooks/useAudioCapture.ts` | **Create** | `useAudioCapture` React hook with `UseAudioCaptureResult` interface |
| `packages/frontend/package.json` | **Modify** | Added `@supabase/supabase-js: ^2.39.0` dependency |
| `pnpm-lock.yaml` | **Auto-update** | Updated by `pnpm install` |

No existing implementation files were modified other than `package.json`. The pre-existing `pnpm-lock.yaml` change and `packages/frontend/src/app/layout.tsx` change are from prior phases, not this task.

## Decisions

1. **Channel name: `sermon-live`** (static). The frontend-spec blueprint used `sermon_${sermonId}`, but the canonical broadcast spec (`docs/realtime-broadcast.md`) and planning handoff explicitly specify `sermon-live`. Used the static name to stay consistent with the viewer subscription code and broadcast spec.

2. **Import path for `AudioOrchestrator`**: Used a relative path `../services/speech/AudioOrchestrator` from `src/hooks/useAudioCapture.ts`, matching the actual project structure (not `./AudioOrchestrator` as shown in the spec blueprint, which assumed a different file location).

3. **Error handling**: Used a single `try/catch` inside the `onTextCaptured` callback covering fetch failure, JSON parse failure, and broadcast failure — with distinct `console.error` messages. The outer `start()` try/catch catches orchestrator initialization or channel subscription errors. All errors set `error` state without throwing.

4. **Cleanup**: The `useEffect` cleanup function directly stops the orchestrator and unsubscribes the channel (following the blueprint pattern), rather than calling the async `stop()` function, to avoid potential issues with async cleanup in React strict mode.

5. **Translation response parsing**: The Edge Function returns `{ translated_text }` at the top level. The hook extracts `data.translated_text` and validates it exists, throwing an error if missing. This matches both the actual Edge Function response and the blueprint pattern.

## Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `supabaseClient.ts` exists and exports | ✅ Exports `supabase` client via `createClient()` |
| 2 | Hook has correct interface `UseAudioCaptureResult` | ✅ `{ isListening, start, stop, latestTranscribedText, error }` |
| 3 | `start()` reads storage correctly | ✅ `speaker_pin` from `sessionStorage`, `asr_provider`/`deepgram_api_key` from `localStorage` |
| 4 | `start()` creates channel `sermon-live` and `AudioOrchestrator` | ✅ Static channel name `'sermon-live'`, orchestrator with correct constructor args |
| 5 | Translation pipeline fires on text captured | ✅ `fetch()` to `/functions/v1/translate` with `x-admin-pin` header |
| 6 | On success: updates history (max 3) and broadcasts | ✅ `shift()` when length > 3; `channel.send()` with `translation_segment` event |
| 7 | On error: sets error state, does not crash | ✅ `try/catch` in callback with `console.error` + `setError` |
| 8 | `stop()` tears down orchestrator and channel | ✅ Calls `orchestrator.stop()`, `channel.unsubscribe()`, sets `isListening = false` |
| 9 | `useEffect` cleanup on unmount | ✅ Cleanup function stops orchestrator and unsubscribes channel |
| 10 | `tsc --noEmit` passes | ✅ Zero errors |
| 11 | `pnpm install` succeeds | ✅ `@supabase/supabase-js` installed, lockfile updated |

### Commands run

- `pnpm install` — Success (3.4s, 8 packages added)
- `pnpm --filter frontend exec tsc --noEmit` — Passed with no errors

### Verification grep results

- `supabase.channel(` → `'sermon-live'` ✅
- Storage keys confirmed: `speaker_pin`, `asr_provider` (default `'deepgram'`), `deepgram_api_key` ✅
- Translation URL: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/translate` ✅
- History limit: `updatedHistory.length > 3` → `updatedHistory.shift()` ✅
- Error handling: `setError` inside callback try/catch ✅
- Cleanup: `useEffect` with cleanup function ✅

## Known Issues

None. All acceptance criteria pass.
