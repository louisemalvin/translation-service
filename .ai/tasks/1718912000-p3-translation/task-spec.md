# Task Spec: Phase 3 — DeepSeek Translation Edge Function

## Source Artifacts / Handoff Context

| Artifact | Role |
|---|---|
| `.ai/tasks/1718912000-p3-translation/planning-handoff.md` | Canonical scope, constraints, and acceptance signals |
| `docs/implementation-plans/phase-3-translation-function.md` | Primary code blueprint (structural reference) |
| `docs/translation-brain.md` | Full system prompt with theological glossary, sliding context window design, output contract, and JSON fallback parsing |
| `docs/realtime-broadcast.md` | PIN-gate security model, env var definitions (DEEPSEEK_API_KEY, DEEPSEEK_API_URL, ADMIN_PIN_HASH) |
| `docs/system-architecture.md` | Latency targets, architecture overview, sequence flow |
| `.ai/context.md` | Project conventions (TypeScript strict, kebab-case files, camelCase functions, PascalCase types) |

**Model name resolution**: The `.ai/context.md` mentions "DeepSeek V4-Flash" but the handoff and spec blueprint use `model: "deepseek-chat"` — the spec blueprint's `"deepseek-chat"` is authoritative as it is the API-facing identifier.

**Architecture note**: Broadcasting is client-side (Speaker App → Supabase Realtime), not from this edge function. This function only translates and returns the result in the HTTP response.

## Scope

Create a single file:

```
supabase/functions/translate/index.ts
```

The file implements a stateless Supabase Edge Function (Deno runtime) that:

1. **CORS preflight**: Returns 200 with permissive CORS headers on `OPTIONS` requests. The `Access-Control-Allow-Headers` must include `x-admin-pin`.

2. **PIN authorization gate**:
   - Reads the `x-admin-pin` request header.
   - If missing → `401` with `{ error: "Missing PIN header" }`.
   - Computes SHA-256 hex digest of the PIN string via the **Web Crypto API** (`crypto.subtle.digest`).
   - Compares against `Deno.env.get("ADMIN_PIN_HASH")`. Mismatch → `401` with `{ error: "Unauthorized: Invalid PIN" }`.

3. **Request body parsing**: Parses `{ raw_text: string, history: Array<{ raw: string, translated: string }> }`. If `raw_text` is missing or falsy → `400` with `{ error: "Missing raw_text" }`.

4. **DeepSeek payload construction**:
   - System prompt: Use the **full system prompt** from `docs/translation-brain.md` including the complete Indonesian-English Church Glossary (all 17 glossary entries must be present).
   - Sliding context: Append **at most the last 3 entries** from the `history` array as alternating `user`/`assistant` messages.
   - Final user message: Append the current `raw_text` as the last message.

5. **DeepSeek API call**:
   - URL: `${Deno.env.get("DEEPSEEK_API_URL")}/chat/completions` (default `https://api.deepseek.com/v1`)
   - Auth: `Authorization: Bearer ${Deno.env.get("DEEPSEEK_API_KEY")}`
   - Payload: `{ model: "deepseek-chat", messages, temperature: 0.3, response_format: { type: "json_object" } }`
   - On non-OK response → `500` with the API error text.

6. **Response parsing with JSON fallback** (per `docs/translation-brain.md` Output Contract):
   - **Primary**: `JSON.parse(dsData.choices[0].message.content)` and extract `.translated_text`.
   - **Fallback 1** (invalid JSON): regex-extract content between curly braces, re-parse.
   - **Fallback 2** (regex fails): treat the entire string as the raw translation.
   - **Fallback 3** (cleanup): strip trailing quotes/escape sequences, trim whitespace.
   - If all parsing fails → `500` with a descriptive error.

7. **Success response**: `200` with `Content-Type: application/json` and body `{ translated_text: "..." }`.

8. **Error response**: Any caught error → `500` with `{ error: err.message }`.

## Execution

Pipeline: **implementer → validator**

### Step 1: implementer

Create `supabase/functions/translate/index.ts` following the Deno code blueprint in `docs/implementation-plans/phase-3-translation-function.md` as structural reference, with these mandatory adaptations:

| Blueprint section | Adaptation required |
|---|---|
| System prompt string | Replace the blueprint's shortened prompt with the **full system prompt** from `docs/translation-brain.md` including all 17 glossary entries |
| History context loop | Add `.slice(-3)` to limit history to the **last 3 entries** only (the blueprint iterates all entries) |
| Response parsing | Add the **JSON fallback chain** (regex extraction → raw string fallback → cleanup) per `docs/translation-brain.md` lines 111–115 |
| Imports | Deno-compatible only: `serve` from `https://deno.land/std@0.168.0/http/server.ts`; no npm/Node modules |
| Crypto | Use Web Crypto API (`crypto.subtle.digest`), NOT Node's `crypto` module |
| CORS | `Access-Control-Allow-Headers` must include `x-admin-pin` |

### Step 2: validator

Verify the implementation against the acceptance criteria below. Use `npx supabase functions serve --no-verify-jwt` and curl-based testing as described in the Validation Plan.

## Non-Goals

- **Any frontend changes** (speaker app, viewer SPA)
- **Supabase config changes** (`config.toml`, migrations, seed data)
- **Deepgram / ASR integration** (handled client-side)
- **Realtime broadcast from the edge function** (broadcasting is client-side — the Speaker App receives the translation response and broadcasts via Supabase Realtime)
- **Database writes** (this is a zero-database architecture; no Postgres inserts)
- **JWT verification** (PIN-gate replaces JWT for this function)
- **Environment variable creation** (already present in `supabase/.env.local`)

## Testable Acceptance Criteria

Each criterion is verifiable via the Validation Plan curl commands below.

| # | Criterion | Verification |
|---|---|---|
| T1 | File exists at `supabase/functions/translate/index.ts` | `ls -la supabase/functions/translate/index.ts` |
| T2 | `OPTIONS` request returns `200` with CORS headers | curl `-X OPTIONS` → 200, headers include `access-control-allow-origin`, `access-control-allow-headers` with `x-admin-pin` |
| T3 | Missing `x-admin-pin` header → `401` | curl without the header → `401`, body contains "Missing PIN header" |
| T4 | Invalid PIN → `401` | curl with `x-admin-pin: wrong-pin` → `401`, body contains "Unauthorized" |
| T5 | Missing `raw_text` in body → `400` | curl with valid PIN but `{}` body → `400`, body contains "Missing raw_text" |
| T6 | Valid request → `200` with `{ translated_text: "..." }` | curl with valid PIN + `{"raw_text":"Selamat pagi tuan.","history":[]}` → `200` |
| T7 | Response `Content-Type` is `application/json` | Inspect response headers |
| T8 | DeepSeek API error → `500` | (Simulated by using invalid API key) → `500`, body contains error message |
| T9 | Valid PIN + history context → correct DeepSeek payload | Inspect logs or mock to confirm history is appended as user/assistant messages and limited to 3 |

### Test File Paths

No automated test file is created for this unit. The edge function is validated via manual curl testing against a locally running Supabase instance. See Validation Plan below for the exact curl commands.

## Inspectable Acceptance Criteria

The following must be confirmed by reading the source file:

| # | Criterion |
|---|---|
| I1 | All imports are Deno-compatible (no `npm:`, `node:`, or bare Node.js APIs) |
| I2 | SHA-256 uses `crypto.subtle.digest("SHA-256", msgBuffer)` (Web Crypto API) |
| I3 | `ADMIN_PIN_HASH` read via `Deno.env.get("ADMIN_PIN_HASH")` |
| I4 | `DEEPSEEK_API_KEY` and `DEEPSEEK_API_URL` read via `Deno.env.get(...)` |
| I5 | System prompt includes the complete theological glossary with all 17 Indonesian→English entries from `docs/translation-brain.md` |
| I6 | History array is limited to last 3 entries (e.g., `history.slice(-3)` or equivalent) |
| I7 | DeepSeek request uses `model: "deepseek-chat"`, `temperature: 0.3`, `response_format: { type: "json_object" }` |
| I8 | Response parsing includes JSON fallback chain: primary `JSON.parse` → regex extraction → raw string fallback → cleanup |
| I9 | CORS `Access-Control-Allow-Headers` includes `x-admin-pin` |
| I10 | No database client, Supabase import, or Realtime broadcast logic present |
| I11 | All error responses include CORS headers |

## Relevant Files

| File | Purpose |
|---|---|
| `supabase/functions/translate/index.ts` | **This task's output** — the edge function |
| `supabase/.env.local` | Environment variables (already present; read from, do not modify) |
| `supabase/config.toml` | Supabase config (do not modify) |
| `docs/implementation-plans/phase-3-translation-function.md` | Code blueprint (structural reference) |
| `docs/translation-brain.md` | Full system prompt source, output contract, fallback logic |
| `docs/realtime-broadcast.md` | PIN-gate security model reference |

## Validation Plan

### Prerequisites

1. Supabase CLI installed (`npx supabase --version`)
2. Environment variables set in `supabase/.env.local` (already present)
3. Port 54321 available

### Step 1: Start the edge function server

```bash
npx supabase functions serve --no-verify-jwt
```

Expected output: Server listening on `http://localhost:54321`.

### Step 2: CORS preflight test

```bash
curl -i -X OPTIONS http://localhost:54321/functions/v1/translate \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, x-admin-pin"
```

**Expect**: `200 OK`, CORS headers present, `access-control-allow-headers` includes `x-admin-pin`.

### Step 3: Missing PIN → 401

```bash
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "test", "history": []}'
```

**Expect**: `401 Unauthorized`, body `{"error":"Missing PIN header"}`.

### Step 4: Invalid PIN → 401

```bash
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: wrong-pin" \
  -d '{"raw_text": "test", "history": []}'
```

**Expect**: `401 Unauthorized`, body `{"error":"Unauthorized: Invalid PIN"}`.

### Step 5: Missing raw_text → 400

```bash
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"history": []}'
```

**Expect**: `400 Bad Request`, body `{"error":"Missing raw_text"}`.

### Step 6: Valid translation request → 200

```bash
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"raw_text": "Selamat pagi tuan.", "history": []}'
```

**Expect**: `200 OK`, `Content-Type: application/json`. Body shape: `{"translated_text":"Good morning, Lord."}` (exact wording may vary slightly by model).

### Step 7: Valid request with history context → 200

```bash
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"raw_text": "dan ampunilah kami.", "history": [{"raw": "Bapa kami yang di sorga", "translated": "Our Father in heaven"}, {"raw": "dikuduskanlah nama-Mu", "translated": "hallowed be Your name"}]}'
```

**Expect**: `200 OK`. Translation should reflect contextual awareness from history.

### Step 8: Error simulation (invalid API key)

Temporarily comment out or corrupt the `DEEPSEEK_API_KEY` in `.env.local`, restart `supabase functions serve`, re-run Step 6.

**Expect**: `500 Internal Server Error`, body contains error message (DeepSeek API auth error).

### Step 9: Clean exit

Stop the server with `Ctrl+C`. Restore `.env.local` if modified.

## Open Questions

| # | Question | Status |
|---|---|---|
| Q1 | Is `model: "deepseek-chat"` the correct current API identifier for DeepSeek V4-Flash? | Follow the spec as authoritative. If the API returns a model-not-found error at test time, the validator should note it and the orchestrator can adjust. |
| Q2 | Does `crypto.subtle.digest` work correctly in the Deno 2 runtime configured in `supabase/config.toml` (`deno_version = 2`)? | Should work; Deno 2 supports Web Crypto API natively. If it fails, the validator must report it as a blocker. |
| Q3 | The `ADMIN_PIN_HASH` in `.env.local` (`0f7d0f6b...`) — what plaintext PIN does this correspond to? | The handoff and phase-3 spec assume `SermonTranslate2026!`. The validator should pre-compute the hash of this PIN to confirm it matches the stored hash, or the orchestrator should provide the correct PIN. This is a pre-validation step. |
