import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map(value => value.trim());

function cors(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" }, origin);
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const joinCode = typeof input.joinCode === "string" ? input.joinCode.trim().toUpperCase() : "";
  const requestedAge = typeof input.age === "number" ? Math.round(input.age) : 12;
  const age = Math.min(20, Math.max(5, requestedAge));

  if (name.length < 2 || name.length > 100) return json(400, { error: "Emri duhet të ketë 2–100 karaktere" }, origin);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: "Email i pavlefshëm" }, origin);
  if (password.length < 8 || password.length > 128) return json(400, { error: "Fjalëkalimi duhet të ketë 8–128 karaktere" }, origin);
  if (!/^[A-Z2-9]{6,8}$/.test(joinCode)) return json(400, { error: "Kodi i klasës është i pavlefshëm" }, origin);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: cls, error: classError } = await admin
    .from("classes")
    .select("id,name,teacher_id")
    .eq("join_code", joinCode)
    .maybeSingle();
  if (classError || !cls) return json(404, { error: "Kodi i klasës nuk u gjet" }, origin);

  const className = String(cls.name).replace(/^Klasa\s+/i, "").trim() || String(cls.name);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: "student", class: className },
  });
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes("already");
    return json(duplicate ? 409 : 400, {
      error: duplicate ? "Ekziston tashmë një llogari me këtë email" : "Llogaria e nxënësit nuk u krijua",
    }, origin);
  }

  const userId = created.user.id;
  const student = {
    id: userId,
    teacher_id: cls.teacher_id,
    class_id: cls.id,
    name,
    email,
    class_name: className,
    age,
    reading_level: "Mesatar",
    score: 0,
    completed_materials: 0,
    status: "active",
    preferred_font: "lexend",
    audio_enabled: true,
    visual_preferred: false,
    language: "sq",
  };

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email,
    name,
    role: "student",
    class: className,
  });
  const { error: studentError } = profileError
    ? { error: profileError }
    : await admin.from("students").insert(student);

  if (profileError || studentError) {
    await admin.auth.admin.deleteUser(userId);
    console.error("Student provisioning rolled back", { profileError, studentError });
    return json(500, { error: "Regjistrimi nuk u përfundua; provo përsëri" }, origin);
  }

  return json(201, { registered: true }, origin);
});
