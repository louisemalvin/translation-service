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

function cleanTranslation(text: string): string {
  let cleaned = text.trim();
  
  // Remove leading/trailing escaped double/single quotes or literal double/single quotes
  while (true) {
    const len = cleaned.length;
    if (cleaned.startsWith('\\"') && cleaned.endsWith('\\"')) {
      cleaned = cleaned.substring(2, cleaned.length - 2);
    } else if (cleaned.startsWith('\\\'') && cleaned.endsWith('\\\'')) {
      cleaned = cleaned.substring(2, cleaned.length - 2);
    } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    } else {
      break;
    }
    if (cleaned.length === len) break;
  }
  
  // Strip trailing backslashes/escapes
  cleaned = cleaned.replace(/\\+$/g, '');
  
  return cleaned.trim();
}

function parseTranslationResponse(content: string): string {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error("Empty response content");
  }

  // 1. Primary: JSON.parse and extract .translated_text
  try {
    const parsed = JSON.parse(trimmedContent);
    if (parsed && typeof parsed.translated_text === "string") {
      return cleanTranslation(parsed.translated_text);
    }
  } catch (_) {
    // Proceed to Fallback 1
  }

  // 2. Fallback 1: regex-extract content between curly braces, re-parse.
  const braceMatch = trimmedContent.match(/\{([\s\S]*)\}/);
  if (braceMatch) {
    const innerContent = braceMatch[1];
    try {
      const parsed = JSON.parse(`{${innerContent}}`);
      if (parsed && typeof parsed.translated_text === "string") {
        return cleanTranslation(parsed.translated_text);
      }
    } catch (_) {
      // If parsing fails, try regex extracting the value of "translated_text"
      const textMatch = innerContent.match(/"translated_text"\s*:\s*"([\s\S]*?)"/);
      if (textMatch) {
        return cleanTranslation(textMatch[1]);
      }
    }
  }

  // 3. Fallback 2: treat the entire string as the raw translation.
  // 4. Fallback 3: strip trailing/leading quotes, escape sequences, trim whitespace.
  const rawTranslation = cleanTranslation(trimmedContent);
  if (!rawTranslation) {
    throw new Error("Failed to parse translation from response");
  }
  return rawTranslation;
}

const systemPrompt = `You are the translation engine of a real-time Indonesian-to-English church sermon pipeline.
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
- "Perjamuan Kudus" -> "Holy Communion"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. PIN Authorization Gate
    const pin = req.headers.get("x-admin-pin");
    if (!pin) {
      return new Response(JSON.stringify({ error: "Missing PIN header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const hashedPin = await sha256(pin);
    const targetHash = Deno.env.get("ADMIN_PIN_HASH");

    if (hashedPin !== targetHash) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Parse payload
    let body;
    try {
      body = await req.json();
    } catch (_) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { raw_text, history = [] } = body;
    if (!raw_text) {
      return new Response(JSON.stringify({ error: "Missing raw_text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Build prompts containing glossary and sliding window history
    const messages = [
      { role: "system", content: systemPrompt }
    ];

    // Append history context (limit to last 3 entries)
    const historyLimit = history.slice(-3);
    historyLimit.forEach((h: any) => {
      messages.push({ role: "user", content: `Context Segment (Indonesian): ${h.raw}` });
      messages.push({ role: "assistant", content: `Translation (English): ${h.translated}` });
    });

    // Append the new segment
    messages.push({ role: "user", content: `Translate this new segment (Indonesian): ${raw_text}` });

    // 4. Invoke DeepSeek
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    }
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
    const responseContent = dsData.choices?.[0]?.message?.content;
    if (!responseContent) {
      throw new Error("Empty or invalid response from DeepSeek API");
    }

    const translated_text = parseTranslationResponse(responseContent);

    return new Response(JSON.stringify({ translated_text }), {
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
