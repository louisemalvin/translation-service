# Phase 3: DeepSeek Translation Edge Function — Planning Handoff

- **User Intent**: Implement the stateless `translate` Supabase Edge Function (Deno runtime) that authorizes requests via SHA-256 PIN header, calls the DeepSeek API with sliding history context and a Christian theological glossary, and returns translated English text as JSON.

- **Conversation-Derived Context**: Phases 1-2 are complete (monorepo + Supabase emulator config). This is a single-unit task — one Deno function file at `supabase/functions/translate/index.ts`. The spec provides a complete code blueprint. The edge function runs on Deno (Supabase Edge Functions runtime), so imports must be Deno-compatible (no npm packages, use `https://deno.land/std@0.168.0/http/server.ts`).

- **Source Artifacts / Source Context**:
  - `docs/implementation-plans/phase-3-translation-function.md` — primary spec with complete code blueprint
  - `docs/translation-brain.md` — system prompt design, sliding context window, theological glossary, output contract
  - `docs/realtime-broadcast.md` — PIN-gate security model, env var definitions
  - `docs/system-architecture.md` — latency targets, architecture overview
  - `.ai/context.md` — project conventions (note: says "DeepSeek V4-Flash" but the spec blueprint uses `model: "deepseek-chat"` — follow the spec's model name as it's the API-facing identifier)

- **Proposed Task Shape**: Single-unit task: create the edge function file at `supabase/functions/translate/index.ts`. No scaffolding needed (the file can be created manually or via `npx supabase functions new translate`).

- **Assigned Output Path(s)**: `.ai/tasks/1718912000-p3-translation/task-spec.md` (single unit)

- **Scope and Non-Goals**:
  - IN SCOPE: `supabase/functions/translate/index.ts` with: CORS preflight handling, SHA-256 PIN verification against `ADMIN_PIN_HASH` env var, request body parsing (`raw_text`, `history`), DeepSeek API call with system prompt + sliding context, response parsing with JSON fallback, error handling (401, 400, 500)
  - OUT OF SCOPE: Any frontend changes, Supabase config changes, Deepgram integration, Realtime broadcast from the edge function (broadcasting is done client-side per the architecture)

- **Constraints**:
  - Deno runtime — use `https://deno.land/std@0.168.0/http/server.ts` for serve()
  - Use Web Crypto API for SHA-256 (not Node's crypto module)
  - Model: `deepseek-chat`, temperature: `0.3`, response_format: `{ type: "json_object" }`
  - System prompt must include the full theological glossary from translation-brain.md
  - History limited to last 3 entries in sliding window
  - CORS headers must allow the x-admin-pin header
  - Environment variables: DEEPSEEK_API_KEY, DEEPSEEK_API_URL, ADMIN_PIN_HASH (already in supabase/.env.local)
  - Must handle invalid JSON from DeepSeek with fallback parsing (regex extract, raw string fallback)
  - Follow the code blueprint in phase-3-translation-function.md closely

- **Acceptance Signals**:
  1. File exists at `supabase/functions/translate/index.ts`
  2. Deno-compatible imports only (no npm/node modules)
  3. PIN verification: missing x-admin-pin → 401, invalid PIN → 401
  4. Missing raw_text → 400
  5. Valid request → DeepSeek API call with correct payload shape
  6. DeepSeek response parsed correctly → 200 with `{ translated_text: "..." }`
  7. DeepSeek error → 500 with error message
  8. CORS OPTIONS → 200 with CORS headers
  9. System prompt contains the full theological glossary
  10. History context limited to last 3 entries

- **Authority Boundary**: Task-planner formalizes the spec. Implementer creates the edge function file. Validator confirms acceptance criteria (can run `npx supabase functions serve --no-verify-jwt` and curl test). After validation, orchestrator triggers git commit via shipper.

- **Open Questions / Stop Conditions**:
  - The spec blueprint has a minor bug: `crypto.subtle.digest` should be `crypto.subtle.digest` (correct) — ensure this works in Deno runtime
  - Stop if `npx supabase functions serve` fails
  - The model name `deepseek-chat` in the spec may need confirmation against DeepSeek's current API — follow the spec as authoritative
