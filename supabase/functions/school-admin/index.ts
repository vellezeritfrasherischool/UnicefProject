import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",").map(v => v.trim());
const cors = (origin: string | null): HeadersInit => ({
  "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin",
});
const json = (status: number, body: unknown, origin: string | null) => new Response(JSON.stringify(body), {
  status, headers: { ...cors(origin), "Content-Type": "application/json" },
});
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Authentication required" }, origin);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return json(401, { error: "Invalid session" }, origin);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: membership } = await admin.from("school_members")
    .select("school_id").eq("user_id", user.id).eq("role", "school_admin").eq("active", true).maybeSingle();
  if (!membership) return json(403, { error: "School administrator access required" }, origin);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin); }
  const action = input.action;

  if (action === "list") {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: members }, { data: invites }, { data: classes }, { data: school }, { data: usage }] = await Promise.all([
      admin.from("school_members").select("user_id,role,active,created_at").eq("school_id", membership.school_id),
      admin.from("teacher_invitations").select("id,email,expires_at,used_at,created_at").eq("school_id", membership.school_id).order("created_at", { ascending: false }),
      admin.from("classes").select("id,name,teacher_id,created_at").eq("school_id", membership.school_id),
      admin.from("schools").select("id,name,slug,active").eq("id", membership.school_id).single(),
      admin.from("ai_usage_events").select("operation,success,input_chars").eq("school_id", membership.school_id).gte("created_at", since).limit(5000),
    ]);
    const ids = (members ?? []).map(m => m.user_id);
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id,name,email").in("id", ids)
      : { data: [] };
    const usageSummary = {
      requests30d: usage?.length ?? 0,
      failed30d: usage?.filter(event => !event.success).length ?? 0,
      inputChars30d: usage?.reduce((sum, event) => sum + event.input_chars, 0) ?? 0,
      byOperation: Object.fromEntries(["chat", "speech", "image"].map(operation => [operation, usage?.filter(event => event.operation === operation).length ?? 0])),
    };
    return json(200, { school, members, profiles, invitations: invites, classes, usageSummary }, origin);
  }

  if (action === "invite") {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: "Invalid email" }, origin);
    const code = randomCode();
    const { error } = await admin.from("teacher_invitations").insert({
      school_id: membership.school_id, email, token_hash: await sha256(code), invited_by: user.id,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    if (error) return json(409, { error: "An active invitation may already exist" }, origin);
    return json(201, { code, email, expiresInDays: 7 }, origin);
  }

  if (action === "revoke-invitation") {
    const id = typeof input.id === "string" ? input.id : "";
    const { error } = await admin.from("teacher_invitations").delete()
      .eq("id", id).eq("school_id", membership.school_id).is("used_at", null);
    return error ? json(400, { error: "Invitation could not be revoked" }, origin) : json(200, { revoked: true }, origin);
  }

  if (action === "deactivate-teacher") {
    const userId = typeof input.userId === "string" ? input.userId : "";
    if (!userId || userId === user.id) return json(400, { error: "Invalid teacher" }, origin);
    const { data: target, error } = await admin.from("school_members").update({ active: false })
      .eq("school_id", membership.school_id).eq("user_id", userId).eq("role", "teacher").select("user_id").maybeSingle();
    if (error || !target) return json(404, { error: "Teacher was not found" }, origin);
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    return json(200, { deactivated: true }, origin);
  }

  return json(400, { error: "Unsupported action" }, origin);
});
