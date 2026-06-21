# agy Handoff — Phase 3: DeepSeek Translation Edge Function

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

## Orchestrator Command

Implement Phase 3: DeepSeek Translation Edge Function.

**Task spec**: .ai/tasks/1718912000-p3-translation/task-spec.md
**Planning handoff**: .ai/tasks/1718912000-p3-translation/planning-handoff.md

## Task Spec

Located at: `/home/ltanaka/github/translation-service/.ai/tasks/1718912000-p3-translation/task-spec.md`

Full contents:

```markdown
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
```

## Project Context

`.ai/context.md` contents:

```markdown
# Project: Translation Service

## Overview

**0-Cost Real-Time Church Sermon Translation Pipeline (Indonesian → English).**

Provides live, scrolling English text translations of spoken Indonesian church sermons to attendees' personal mobile devices. Budget constraint: $0 monthly infrastructure hosting cost indefinitely.

### Architecture (ADR Approved)

Decoupled, distributed serverless architecture that offloads all computing from local church hardware.

```
[Pastor's Phone at Pulpit]
       │  (Web Speech API: Audio → Raw Indonesian Text)
       ▼
[Supabase Postgres DB]
       │  (Database Webhook Trigger)
       ▼
[Supabase Edge Function] → [DeepSeek V4-Flash API]
       │                    (Contextual Translation)
       ▼
[Supabase Realtime Sync]
       │  (WebSocket Broadcast)
       ▼
[Congregation Mobile Browsers] (Vercel Static Hosting)
```
```

Key info from `.ai/context.md`:
- Test runner: `npx vitest` (but this function has no automated tests — validated via curl)
- Conventions: TypeScript strict, kebab-case files, camelCase functions, PascalCase types
- Edge Functions: Deno-compatible imports only
- `agy: enabled` — agy delegation is active

## Relevant Files

### File: `supabase/.env.local`
Path: `/home/ltanaka/github/translation-service/supabase/.env.local`
```
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
ADMIN_PIN_HASH=0f7d0f6b15be5f7a0df98ca3de2c30d5fef1ebd8c06bcdfef6dd629591461789
```

### File: `docs/implementation-plans/phase-3-translation-function.md`
Path: `/home/ltanaka/github/translation-service/docs/implementation-plans/phase-3-translation-function.md`
(This is the code blueprint — see full contents below)

### File: `docs/translation-brain.md`
Path: `/home/ltanaka/github/translation-service/docs/translation-brain.md`
System prompt and full glossary — full contents below.

---

**docs/translation-brain.md system prompt** (full content — use this for the system prompt string):

```
You are the translation engine of a real-time Indonesian-to-English church sermon pipeline.
Your goal is to translate spoken Indonesian into natural, grammatically correct, and contextually appropriate English.

Core Instructions:
1. Translate conversational Indonesian to natural, readable English suitable for displaying live to a church congregation.
2. Correct ASR (Automatic Speech Recognition) transcription typos. Spoken Indonesian often results in phonetically similar typos (e.g., "tuan" instead of "Tuhan", "yesus" instead of "Yesus", "roh kudus" instead of "Roh Kudus"). Use the surrounding sermon context to repair these spelling errors.
3. Align translations with Christian theological terminology (see the Indonesian-English church glossary below).
4. Keep translations concise and immediate. Do not add commentary, explanations, formatting markers, or conversational filler.
5. Translate the final user prompt. You are provided up to 3 prior segments as context to preserve flow and pronoun antecedents. Do NOT translate the context segments; only translate the LAST segment.
6. Return your output STRICTLY in JSON format with a single key "translated_text" containing the translated string.

Indonesian-English Church Glossary:
- "Tuhan" -> "Lord" (rarely "Sir" or "master" in this context)
- "Bapa" -> "Father"
- "Roh Kudus" -> "Holy Spirit"
- "Firman" -> "Word" (e.g., "Firman Tuhan" -> "Word of God")
- "Kasih karunia" -> "Grace"
- "Jemaat" / "Umat" -> "Congregation" / "Church members"
- "Alkitab" -> "Bible"
- "Gembala" / "Pendeta" -> "Pastor"
- "Kristus" -> "Christ"
- "Salib" / "Penyaliban" -> "Cross" / "Crucifixion"
- "Kebaktian" / "Ibadah" -> "Service" / "Worship service"
- "Pujian" / "Penyembahan" -> "Praise" / "Worship"
- "Keselamatan" -> "Salvation"
- "Dosa" -> "Sin"
- "Kerajaan Allah" -> "Kingdom of God"
- "Penebusan" -> "Redemption"
- "Saksi" -> "Witness"
- "Mujizat" -> "Miracle"
- "Perjamuan Kudus" -> "Holy Communion"
```

Note: Count the glossary entries: Tuhan, Bapa, Roh Kudus, Firman, Kasih karunia, Jemaat/Umat, Alkitab, Gembala/Pendeta, Kristus, Salib/Penyaliban, Kebaktian/Ibadah, Pujian/Penyembahan, Keselamatan, Dosa, Kerajaan Allah, Penebusan, Saksi, Mujizat, Perjamuan Kudus — that's 19 lines but the spec says "all 17 glossary entries". The entries that are pairs (Jemaat/Umat, Gembala/Pendeta, etc.) each count as ONE entry. Let me count properly:
1. Tuhan -> Lord
2. Bapa -> Father
3. Roh Kudus -> Holy Spirit
4. Firman -> Word
5. Kasih karunia -> Grace
6. Jemaat / Umat -> Congregation / Church members
7. Alkitab -> Bible
8. Gembala / Pendeta -> Pastor
9. Kristus -> Christ
10. Salib / Penyaliban -> Cross / Crucifixion
11. Kebaktian / Ibadah -> Service / Worship service
12. Pujian / Penyembahan -> Praise / Worship
13. Keselamatan -> Salvation
14. Dosa -> Sin
15. Kerajaan Allah -> Kingdom of God
16. Penebusan -> Redemption
17. Saksi -> Witness
18. Mujizat -> Miracle
19. Perjamuan Kudus -> Holy Communion

That's 19 entries. The spec says "all 17 glossary entries" but the source has 19. Include ALL entries from the source file. The spec's mention of "17" may be an approximation. Use all entries as they appear in translation-brain.md.

**docs/translation-brain.md Response Parsing Fallback** (lines 110-115):
```
### Parsing Edge-Case Handler
If DeepSeek returns invalid JSON or fails to include the "translated_text" key, the Edge Function fallback executes:
1. Attempt to regex-parse content between curly braces.
2. If regex extraction fails, fall back to treating the entire returned string as the raw translation.
3. Strip trailing quotes or escape sequences.
4. Trim surrounding whitespace.
```

---

**docs/implementation-plans/phase-3-translation-function.md code blueprint** (structural reference):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SHA-256 hashing helper using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. PIN Authorization Gate
    const pin = req.headers.get("x-admin-pin");
    if (!pin) {
      return new Response(JSON.stringify({ error: "Missing PIN header" }), { status: 401, headers: corsHeaders });
    }

    const hashedPin = await sha256(pin);
    const targetHash = Deno.env.get("ADMIN_PIN_HASH");

    if (hashedPin !== targetHash) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid PIN" }), { status: 401, headers: corsHeaders });
    }

    // 2. Parse payload
    const { raw_text, history } = await req.json();
    if (!raw_text) {
      return new Response(JSON.stringify({ error: "Missing raw_text" }), { status: 400, headers: corsHeaders });
    }

    // 3. Build prompts containing glossary and sliding window history
    const systemPrompt = `You are the translation engine of a real-time Indonesian-to-English church sermon pipeline.
Translate conversational Indonesian to natural, readable English for display to a church congregation.
Correct ASR transcription typos using surrounding context (e.g. "tuan" -> "Tuhan", "yesus" -> "Yesus").
Christian Glossary: "Tuhan" -> "Lord", "Bapa" -> "Father", "Roh Kudus" -> "Holy Spirit", "Firman" -> "Word".
Do NOT translate the context history, only translate the final prompt.
Return output strictly in JSON format: { "translated_text": "english_translation_here" }`;

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Append history context (limit to last 3 entries)
    history.forEach((h: any) => {
      messages.push({ role: "user", content: `Context Segment (Indonesian): ${h.raw}` });
      messages.push({ role: "assistant", content: `Translation (English): ${h.translated}` });
    });

    // Append the new segment
    messages.push({ role: "user", content: `Translate this new segment (Indonesian): ${raw_text}` });

    // 4. Invoke DeepSeek
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    const apiUrl = Deno.env.get("DEEPSEEK_API_URL") || "https://api.deepseek.com/v1";

    const dsResponse = await fetch(`${apiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!dsResponse.ok) {
      const errorText = await dsResponse.text();
      throw new Error(`DeepSeek API error: ${errorText}`);
    }

    const dsData = await dsResponse.json();
    const resultJson = JSON.parse(dsData.choices[0].message.content);

    return new Response(JSON.stringify({ translated_text: resultJson.translated_text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### Required adaptations from blueprint:
1. **System prompt**: Replace blueprint's shortened prompt with FULL system prompt from translation-brain.md (ALL glossary entries)
2. **History loop**: Add `.slice(-3)` to limit to last 3 entries
3. **Response parsing**: Add full JSON fallback chain (primary parse → regex extraction → raw string fallback → cleanup)
4. **Imports**: Keep Deno-compatible only
5. **Crypto**: Use Web Crypto API (already done in blueprint)
6. **CORS**: Must include `x-admin-pin` (already done in blueprint)

## Report Path

`/home/ltanaka/github/translation-service/.ai/tasks/1718912000-p3-translation/implementation-report.md`

## Verification Commands

The task spec's Validation Plan uses `npx supabase functions serve --no-verify-jwt` and curl testing. Commands to verify:

```bash
# CORS preflight
curl -i -X OPTIONS http://localhost:54321/functions/v1/translate \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, x-admin-pin"

# Missing PIN
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -d '{"raw_text": "test", "history": []}'

# Invalid PIN
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: wrong-pin" \
  -d '{"raw_text": "test", "history": []}'

# Missing raw_text
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"history": []}'

# Valid request
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"raw_text": "Selamat pagi tuan.", "history": []}'

# Valid request with history
curl -i -X POST http://localhost:54321/functions/v1/translate \
  -H "Content-Type: application/json" \
  -H "x-admin-pin: SermonTranslate2026!" \
  -d '{"raw_text": "dan ampunilah kami.", "history": [{"raw": "Bapa kami yang di sorga", "translated": "Our Father in heaven"}, {"raw": "dikuduskanlah nama-Mu", "translated": "hallowed be Your name"}]}'
```

## Constraints and Non-Goals

- No frontend changes (speaker app, viewer SPA)
- No Supabase config changes (`config.toml`, migrations, seed data)
- No Deepgram / ASR integration (handled client-side)
- No Realtime broadcast from the edge function (broadcasting is client-side)
- No database writes (zero-database architecture; no Postgres inserts)
- No JWT verification (PIN-gate replaces JWT)
- No environment variable creation (already present in `supabase/.env.local`)
- Deno runtime — use `https://deno.land/std@0.168.0/http/server.ts` only
- Use Web Crypto API for SHA-256 (not Node's crypto module)
- Model: `deepseek-chat`, temperature: `0.3`, response_format: `{ type: "json_object" }`
- System prompt must include full theological glossary from translation-brain.md
- History limited to last 3 entries via `.slice(-3)`
- CORS headers must allow the `x-admin-pin` header
- Must handle invalid JSON with fallback parsing chain

## Stop Conditions

- Stop if `npx supabase functions serve` fails
- Stop if Deno compilation errors occur
- Stop if any import cannot be resolved or is not Deno-compatible
- Stop if the crypto.subtle.digest API is not available
- Report any ambiguity or spec conflicts back to orchestrator

## Explicit Instructions

1. Only create/modify `supabase/functions/translate/index.ts`. Create the directory if needed.
2. Do NOT edit `.ai/tasks/**` except this handoff file and the implementation report.
3. Do NOT edit `.ai/context.md` or `.ai/decisions/**`.
4. Do NOT edit any other files in `supabase/` or `docs/`.
5. Preserve all unrelated changes in the codebase.
6. After completing all edits, write the implementation report at `/home/ltanaka/github/translation-service/.ai/tasks/1718912000-p3-translation/implementation-report.md`.
7. Do NOT commit, amend, or push any changes.
8. Do NOT write test files.
9. Do NOT add backward compatibility, dependencies, abstractions, new files, or broad rewrites.
