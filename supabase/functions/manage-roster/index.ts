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
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return json(401, { error: "Invalid session" }, origin);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: membership } = await admin.from("school_members").select("school_id,role,active")
    .eq("user_id", user.id).eq("active", true).in("role", ["teacher", "school_admin"]).maybeSingle();
  if (!membership) return json(403, { error: "Active teacher membership required" }, origin);

  const action = typeof input.action === "string" ? input.action : "";
  const classId = typeof input.classId === "string" ? input.classId.trim() : "";
  const studentId = typeof input.studentId === "string" ? input.studentId.trim() : "";

  if (action === "update-class") {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!classId || name.length < 1 || name.length > 80) return json(400, { error: "Invalid class name" }, origin);
    const { data: cls } = await admin.from("classes").select("id,name,teacher_id,school_id").eq("id", classId).maybeSingle();
    if (!cls || cls.teacher_id !== user.id || cls.school_id !== membership.school_id) return json(404, { error: "Class not found" }, origin);
    const { error } = await admin.from("classes").update({ name }).eq("id", classId).eq("teacher_id", user.id);
    if (error) return json(409, { error: "Class could not be updated" }, origin);
    const { data: roster } = await admin.from("students").select("id").eq("class_id", classId).eq("teacher_id", user.id);
    await admin.from("students").update({ class_name: name }).eq("class_id", classId).eq("teacher_id", user.id);
    const ids = (roster ?? []).map(row => row.id);
    if (ids.length) await admin.from("profiles").update({ class: name }).in("id", ids);
    await admin.from("materials").update({ class: name }).eq("teacher_id", user.id).eq("class", cls.name);
    return json(200, { updated: true }, origin);
  }

  if (action === "delete-class") {
    if (!classId) return json(400, { error: "Class is required" }, origin);
    const { data: cls } = await admin.from("classes").select("id,name,teacher_id,school_id").eq("id", classId).maybeSingle();
    if (!cls || cls.teacher_id !== user.id || cls.school_id !== membership.school_id) return json(404, { error: "Class not found" }, origin);
    const [{ count: studentCount }, { count: materialCount }] = await Promise.all([
      admin.from("students").select("id", { count: "exact", head: true }).eq("class_id", classId),
      admin.from("materials").select("id", { count: "exact", head: true }).eq("teacher_id", user.id).eq("class", cls.name),
    ]);
    if ((studentCount ?? 0) > 0 || (materialCount ?? 0) > 0) {
      return json(409, { error: "Remove the class students and materials before deleting the class" }, origin);
    }
    const { error } = await admin.from("classes").delete().eq("id", classId).eq("teacher_id", user.id);
    if (error) return json(409, { error: "Class could not be deleted" }, origin);
    return json(200, { deleted: true }, origin);
  }

  const { data: student } = await admin.from("students").select("*").eq("id", studentId).maybeSingle();
  if (!student || student.teacher_id !== user.id) return json(404, { error: "Student not found" }, origin);

  if (action === "update-student") {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const age = Number(input.age);
    const readingLevel = typeof input.readingLevel === "string" ? input.readingLevel : "Mesatar";
    const targetClassId = typeof input.targetClassId === "string" ? input.targetClassId.trim() : student.class_id;
    if (name.length < 2 || name.length > 100 || !Number.isInteger(age) || age < 5 || age > 20 || !["Bazik", "Mesatar", "Avancuar"].includes(readingLevel)) {
      return json(400, { error: "Invalid student details" }, origin);
    }
    const { data: cls } = await admin.from("classes").select("id,name,teacher_id,school_id").eq("id", targetClassId).maybeSingle();
    if (!cls || cls.teacher_id !== user.id || cls.school_id !== membership.school_id) return json(404, { error: "Target class not found" }, origin);
    const patch = { name, age, reading_level: readingLevel, class_id: cls.id, class_name: cls.name,
      audio_enabled: input.audioEnabled !== false, visual_preferred: input.visualPreferred === true };
    const { data: updated, error } = await admin.from("students").update(patch).eq("id", studentId).eq("teacher_id", user.id).select("*").single();
    if (error) return json(409, { error: "Student could not be updated" }, origin);
    await admin.from("profiles").update({ name, class: cls.name }).eq("id", studentId);
    return json(200, { student: updated }, origin);
  }

  if (action === "delete-student") {
    const tables = ["assignments", "learning_reports", "learning_profiles", "memory_boosters", "learning_events", "xp_transactions", "student_badges"];
    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq("student_id", studentId);
      if (error) {
        console.error("Student cleanup failed", { table, studentId, code: error.code });
        return json(500, { error: "Student data cleanup failed" }, origin);
      }
    }
    const { error } = await admin.auth.admin.deleteUser(studentId);
    if (error) return json(500, { error: "Student account could not be deleted" }, origin);
    return json(200, { deleted: true }, origin);
  }

  return json(400, { error: "Unknown action" }, origin);
});
