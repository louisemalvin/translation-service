import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Centralized Configuration Constants
const MAX_PIN_FAILURES = 5;
const PIN_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DEEPGRAM_TOKEN_TTL_SECONDS = 14400; // 4 hours

// In-memory rate limiting and blocking states
const pinFailures = new Map<string, { count: number; blockedUntil: number }>();

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "*";
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (allowedOriginsEnv !== undefined && allowedOriginsEnv !== null) {
    const allowedOrigins = allowedOriginsEnv.split(",").map(o => o.trim());
    if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    } else {
      allowOrigin = allowedOrigins[0] || ""; // fail CORS for unauthorized origins
    }
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",");
    const clientIp = parts[0].trim();
    if (clientIp) return clientIp;
  }

  return "unknown-ip";
}

// SHA-256 hashing helper using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = getClientIp(req);
  const now = Date.now();

  // Check if IP is blocked due to excessive PIN failures
  const failureRecord = pinFailures.get(ip);
  if (failureRecord && now < failureRecord.blockedUntil) {
    return new Response(
      JSON.stringify({ error: "IP temporarily blocked due to multiple PIN verification failures" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 1. PIN Authorization Gate (with salted hash check)
    const pin = req.headers.get("x-admin-pin");
    if (!pin) {
      const record = pinFailures.get(ip) || { count: 0, blockedUntil: 0 };
      record.count += 1;
      if (record.count >= MAX_PIN_FAILURES) {
        record.blockedUntil = now + PIN_BLOCK_DURATION_MS;
      }
      pinFailures.set(ip, record);

      return new Response(JSON.stringify({ error: "Missing PIN header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const salt = Deno.env.get("PIN_SALT") || "";
    const hashedPin = await sha256(salt + pin);
    const targetHash = Deno.env.get("ADMIN_PIN_HASH");

    if (hashedPin !== targetHash) {
      const record = pinFailures.get(ip) || { count: 0, blockedUntil: 0 };
      record.count += 1;
      if (record.count >= MAX_PIN_FAILURES) {
        record.blockedUntil = now + PIN_BLOCK_DURATION_MS;
      }
      pinFailures.set(ip, record);

      return new Response(JSON.stringify({ error: "Unauthorized: Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Reset PIN failure count on success
    pinFailures.delete(ip);

    // 2. Fetch Deepgram Token
    const deepgramApiKey = Deno.env.get("DEEPGRAM_API_KEY");
    const projectId = Deno.env.get("DEEPGRAM_PROJECT_ID");

    if (!deepgramApiKey || !projectId) {
      console.error("Missing DEEPGRAM_API_KEY or DEEPGRAM_PROJECT_ID environment variables");
      return new Response(
        JSON.stringify({ error: "Deepgram authentication is misconfigured on the server" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const dgResponse = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Short-lived client-side session key",
        scopes: ["usage:write"],
        time_to_live_in_seconds: DEEPGRAM_TOKEN_TTL_SECONDS
      })
    });

    if (!dgResponse.ok) {
      const errorText = await dgResponse.text();
      console.error(`Deepgram API returned error status: ${dgResponse.status}, body: ${errorText}`);
      throw new Error(`Deepgram token request failed with status ${dgResponse.status}`);
    }

    const dgData = await dgResponse.json();
    const key = dgData.key;
    if (!key) {
      console.error("Deepgram response body missing expected key property", dgData);
      throw new Error("Invalid response received from Deepgram");
    }

    return new Response(JSON.stringify({ key, token: key }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Internal get-deepgram-token handler error:", err);
    // Generic error payload to prevent detail leakage
    return new Response(JSON.stringify({ error: "Deepgram token service error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
