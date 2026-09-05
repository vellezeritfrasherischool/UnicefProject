import { createClient } from "npm:@supabase/supabase-js@2";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-5.6-sol";
const OPENAI_TTS_MODEL = Deno.env.get("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts";
const OPENAI_IMAGE_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const MAX_REQUEST_BYTES = 60_000;
const MAX_CHAT_CHARS = 32_000;
const MAX_TTS_CHARS = 3_500;
const MAX_IMAGE_PROMPT_CHARS = 700;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const usage = new Map<string, { count: number; resetAt: number }>();

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function withinRateLimit(userId: string): boolean {
  const now = Date.now();
  const current = usage.get(userId);
  if (!current || current.resetAt <= now) {
    usage.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

async function openAi(path: string, body: unknown): Promise<Response> {
  return fetch(`https://api.openai.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("ai-gateway is missing required server secrets");
    return json(503, { error: "AI service is not configured" }, origin);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Authentication required" }, origin);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "Invalid or expired session" }, origin);
  if (!withinRateLimit(user.id)) return json(429, { error: "Too many AI requests. Try again shortly." }, origin);

  const admin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;
  let schoolId: string | null = null;
  if (admin) {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const [{ data: membership }, { count, error: usageError }] = await Promise.all([
      admin.from("school_members").select("school_id").eq("user_id", user.id).eq("active", true).maybeSingle(),
      admin.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since),
    ]);
    schoolId = membership?.school_id ?? null;
    // Missing table during a staged migration falls back to the instance limit.
    if (!usageError && (count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      return json(429, { error: "Too many AI requests. Try again shortly." }, origin);
    }
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
    return json(413, { error: "Request is too large" }, origin);
  }

  let input: { operation?: string; payload?: Record<string, unknown> };
  try {
    input = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  try {
    const recordUsage = async (success: boolean, providerStatus: number | null, inputChars: number) => {
      if (!admin || !["chat", "speech", "image"].includes(input.operation ?? "")) return;
      await admin.from("ai_usage_events").insert({
        user_id: user.id, school_id: schoolId, operation: input.operation,
        input_chars: inputChars, success, provider_status: providerStatus,
      }).then(({ error }) => { if (error) console.error("AI usage record failed", { userId: user.id }); });
    };
    if (input.operation === "chat") {
      const messages = input.payload?.messages as ChatMessage[] | undefined;
      if (!Array.isArray(messages) || messages.length < 1 || messages.length > 24) {
        return json(400, { error: "Invalid messages" }, origin);
      }
      const validRoles = new Set(["system", "user", "assistant"]);
      if (messages.some((m) => !validRoles.has(m?.role) || typeof m?.content !== "string")) {
        return json(400, { error: "Invalid message format" }, origin);
      }
      const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
      if (!totalChars || totalChars > MAX_CHAT_CHARS) return json(400, { error: "AI text is empty or too long" }, origin);

      const body: Record<string, unknown> = {
        model: OPENAI_TEXT_MODEL,
        messages,
        ...(input.payload?.json ? { response_format: { type: "json_object" } } : {}),
      };
      if (!OPENAI_TEXT_MODEL.startsWith("gpt-5.6") && typeof input.payload?.temperature === "number") {
        body.temperature = Math.max(0, Math.min(1, input.payload.temperature));
      }
      const response = await openAi("chat/completions", body);
      const provider = await response.json().catch(() => null);
      if (!response.ok) {
        await recordUsage(false, response.status, totalChars);
        console.error("AI chat failed", { status: response.status, userId: user.id });
        return json(response.status === 429 ? 429 : 502, { error: response.status === 429 ? "AI quota or rate limit reached" : "AI request failed" }, origin);
      }
      const content = provider?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) return json(502, { error: "AI returned an empty response" }, origin);
      await recordUsage(true, response.status, totalChars);
      return json(200, { content: content.trim() }, origin);
    }

    if (input.operation === "speech") {
      const text = typeof input.payload?.input === "string" ? input.payload.input.trim() : "";
      const language = input.payload?.language === "en" ? "en" : "sq";
      if (!text || text.length > MAX_TTS_CHARS) return json(400, { error: "Speech text is empty or too long" }, origin);
      const instructions = language === "en"
        ? "Speak clear, natural English at a calm educational pace suitable for children ages 8-12."
        : "Speak in clear, natural Albanian (Shqip), at a calm educational pace suitable for children.";
      let response = await openAi("audio/speech", { model: OPENAI_TTS_MODEL, voice: "nova", input: text, instructions });
      if (!response.ok && OPENAI_TTS_MODEL !== "tts-1") {
        response = await openAi("audio/speech", { model: "tts-1", voice: "nova", input: text });
      }
      if (!response.ok) {
        await recordUsage(false, response.status, text.length);
        console.error("AI speech failed", { status: response.status, userId: user.id });
        return json(response.status === 429 ? 429 : 502, { error: "Speech generation failed" }, origin);
      }
      await recordUsage(true, response.status, text.length);
      return new Response(response.body, {
        status: 200,
        // functions-js converts application/octet-stream to Blob. Returning
        // audio/mpeg makes the SDK decode binary audio as text.
        headers: {
          ...corsHeaders(origin),
          "Content-Type": "application/octet-stream",
          "X-Content-Type": response.headers.get("Content-Type") ?? "audio/mpeg",
        },
      });
    }

    if (input.operation === "image") {
      const prompt = typeof input.payload?.prompt === "string" ? input.payload.prompt.trim() : "";
      if (!prompt || prompt.length > MAX_IMAGE_PROMPT_CHARS) return json(400, { error: "Image prompt is empty or too long" }, origin);
      const response = await openAi("images/generations", {
        model: OPENAI_IMAGE_MODEL,
        prompt,
        n: 1,
        size: "1024x1024",
        quality: OPENAI_IMAGE_MODEL === "gpt-image-1" ? "low" : "standard",
      });
      const provider = await response.json().catch(() => null);
      if (!response.ok) {
        await recordUsage(false, response.status, prompt.length);
        console.error("AI image failed", { status: response.status, userId: user.id });
        return json(response.status === 429 ? 429 : 502, { error: "Image generation failed" }, origin);
      }
      const item = provider?.data?.[0];
      const image = item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
      if (!image) return json(502, { error: "AI returned no image" }, origin);
      await recordUsage(true, response.status, prompt.length);
      return json(200, { image }, origin);
    }

    return json(400, { error: "Unsupported AI operation" }, origin);
  } catch (error) {
    console.error("AI gateway failure", { userId: user.id, message: error instanceof Error ? error.message : "unknown" });
    return json(502, { error: "AI service temporarily unavailable" }, origin);
  }
});
