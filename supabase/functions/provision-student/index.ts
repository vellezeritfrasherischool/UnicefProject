import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",").map((value) => value.trim()).filter(Boolean);

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Authentication required" }, origin);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json(401, { error: "Invalid or expired session" }, origin);

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin); }
  const classId = typeof input.classId === "string" ? input.classId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const age = Number(input.age);
  if (!classId || name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email)) {
    return json(400, { error: "Invalid student details" }, origin);
  }
  if (password.length < 8 || password.length > 128 || !Number.isInteger(age) || age < 5 || age > 25) {
    return json(400, { error: "Invalid password or age" }, origin);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const [{ data: profile }, { data: cls }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("classes").select("id,name,teacher_id").eq("id", classId).maybeSingle(),
  ]);
  if (profile?.role !== "teacher" || !cls || cls.teacher_id !== user.id) {
    return json(403, { error: "You cannot manage this class" }, origin);
  }

  const className = String(cls.name).replace(/^Klasa\s+/i, "").trim() || String(cls.name);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student", class: className },
  });
  if (createError || !created.user) {
    console.error("Student auth provisioning failed", { teacherId: user.id, code: createError?.code });
    return json(createError?.code === "email_exists" ? 409 : 400, { error: "Student account could not be created" }, origin);
  }

  const studentId = created.user.id;
  const student = {
    id: studentId,
    teacher_id: user.id,
    class_id: classId,
    name,
    email,
    class_name: className,
    age,
    reading_level: typeof input.readingLevel === "string" ? input.readingLevel.slice(0, 40) : "Mesatar",
    score: 0,
    completed_materials: 0,
    status: "active",
    preferred_font: "lexend",
    audio_enabled: input.audioEnabled !== false,
    visual_preferred: input.visualPreferred === true,
    language: "sq",
  };

  // Migration 003's Auth trigger may already have created this minimal profile.
  // Upsert completes it without failing on the existing primary key.
  const { error: profileError } = await admin.from("profiles").upsert({
    id: studentId, email, name, role: "student", class: className,
  });
  const { error: studentError } = profileError
    ? { error: profileError }
    : await admin.from("students").insert(student);
  if (profileError || studentError) {
    await admin.auth.admin.deleteUser(studentId);
    console.error("Student data provisioning failed", {
      teacherId: user.id,
      profileCode: profileError?.code,
      studentCode: studentError?.code,
    });
    return json(500, { error: "Student account setup could not be completed" }, origin);
  }

  return json(201, { student }, origin);
});
