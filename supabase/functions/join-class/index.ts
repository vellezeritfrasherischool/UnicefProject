import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",").map(v => v.trim());
function cors(origin: string | null): HeadersInit { return {
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin",
}; }
function json(status: number, body: unknown, origin: string | null) { return new Response(JSON.stringify(body), {
  status, headers: { ...cors(origin), "Content-Type": "application/json" },
}); }

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  const authorization = request.headers.get("Authorization") ?? "";
  if (request.method !== "POST" || !authorization.startsWith("Bearer ")) return json(401, { error: "Authentication required" }, origin);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json(401, { error: "Invalid or expired session" }, origin);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin); }
  const joinCode = typeof input.joinCode === "string" ? input.joinCode.trim().toUpperCase() : "";
  if (!/^[A-Z2-9]{6,8}$/.test(joinCode)) return json(400, { error: "Invalid class code" }, origin);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const [{ data: profile }, { data: existing }, { data: cls }] = await Promise.all([
    admin.from("profiles").select("id,email,name,role,class").eq("id", user.id).maybeSingle(),
    admin.from("students").select("id").eq("id", user.id).maybeSingle(),
    admin.from("classes").select("id,name,teacher_id").eq("join_code", joinCode).maybeSingle(),
  ]);
  if (!profile || profile.role !== "student") return json(403, { error: "Only students can join a class" }, origin);
  if (existing) return json(409, { error: "Student already belongs to a class" }, origin);
  if (!cls) return json(404, { error: "Class code was not found" }, origin);
  const className = String(cls.name).replace(/^Klasa\s+/i, "").trim() || String(cls.name);
  const student = {
    id: user.id, teacher_id: cls.teacher_id, class_id: cls.id, name: profile.name,
    email: profile.email, class_name: className, age: 12, reading_level: "Mesatar",
    score: 0, completed_materials: 0, status: "active", preferred_font: "lexend",
    audio_enabled: true, visual_preferred: false, language: "sq",
  };
  const { error: insertError } = await admin.from("students").insert(student);
  if (insertError) return json(409, { error: "Student could not join this class" }, origin);
  const { error: updateError } = await admin.from("profiles").update({ class: className }).eq("id", user.id);
  if (updateError) {
    await admin.from("students").delete().eq("id", user.id);
    return json(500, { error: "Class membership could not be completed" }, origin);
  }
  return json(200, { student, user: { ...profile, class: className } }, origin);
});

