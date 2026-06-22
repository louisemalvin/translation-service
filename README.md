# Real-Time Indonesian to English AI Translator

A low-latency, real-time Indonesian to English voice translation pipeline. It transcribes spoken Indonesian audio client-side, translates it using the DeepSeek API via a serverless proxy, and broadcasts the output ephemerally to connected clients using WebSockets.

The architecture is stateless and stores no translation data, using ephemeral broadcast channels to eliminate database storage requirements.

## 👥 User Roles & Goals

This system supports three distinct user experiences:

*   **The Speaker (e.g., Presenter / Pastor)**: Speaks Indonesian naturally and broadcasts instant English translations. The client PWA keeps their phone screen active (via Screen Wake Lock API) and displays live volume input levels.
*   **The Viewer (e.g., Attendee)**: Views a scrolling, high-contrast, low-glare translation feed on their phone. Can toggle text-to-speech to listen through headphones. Requires no login or setup.
*   **The Administrator (e.g., AV Tech)**: Monitors translation packets via a debugger console. Deploys the system statelessly at $0 infrastructure cost.

For a detailed breakdown of user intents, mental models, and how they map down to frontend and backend services, refer to the **[User Journey & System Goals Specification](file:///home/ltanaka/github/translation-service/docs/user-journey-and-goals.md)**.

## Features

- **Audio Capture & ASR**: Real-time microphone audio streaming to Deepgram WebSockets with browser-native Web Speech API as a fallback.
- **Contextual Translation**: Serverless proxy (Supabase Edge Function) that batches the translation requests, maintains a sliding context window of the last 3 segments to preserve sentence flow, and uses a custom glossary to align translations.
- **Ephemeral Broadcast**: Supabase Realtime WebSocket propagation pushes translated text to viewers immediately without postgres storage writes.
- **Access Control**: SHA-256 PIN gate protecting the translation API and limiting Deepgram token generation, backed by in-memory rate limits.
- **Interactive Interfaces**:
  - `/` - Public viewer console with client-side Text-to-Speech (TTS) audio synthesis and font size controls.
  - `/speaker` - PIN-gated speaker page with a screen wake lock and volume VU levels.
  - `/admin` - PIN-gated developer debug console to monitor raw and translated segments side-by-side.

## Repository Structure

- `packages/frontend/` - Next.js SPA application.
- `packages/shared/` - Common TypeScript types and static window variables.
- `supabase/` - Local Supabase emulator setup and Deno Edge Functions (`translate`, `get-deepgram-token`).
- `docs/` - Technical specifications detailing system design and guidelines.

## Local Setup

### Prerequisites
- Node.js (v18+)
- pnpm
- Docker (for running the local Supabase emulator stack)
- Supabase CLI

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Variables

Create `packages/frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Create `supabase/.env.local`:
```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1
ADMIN_PIN_HASH=0f7d0f6b15be5f7a0df98ca3de2c30d5fef1ebd8c06bcdfef6dd629591461789
PIN_SALT=
```
*(Note: The `ADMIN_PIN_HASH` above corresponds to the PIN `1234` hashed with SHA-256 and no salt).*

### 3. Run Development Servers
```bash
pnpm dev
```
This runs the local Supabase containers and the Next.js server concurrently.

## Production Deployment

### 1. Edge Functions
```bash
supabase secrets set DEEPSEEK_API_KEY=your_key ADMIN_PIN_HASH=your_hash --project-ref your_project_ref
supabase functions deploy translate --project-ref your_project_ref
supabase functions deploy get-deepgram-token --project-ref your_project_ref
```

### 2. Frontend
Deploy the `packages/frontend` workspace package to Vercel, pointing the environment variables to your production Supabase project.
