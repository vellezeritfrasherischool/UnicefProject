import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const origins = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",").map(v => v.trim());

function headers(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin && origins.includes(origin) ? origin : origins[0],
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json" } });
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { headers: headers(origin) });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json(400, { error: "Invalid JSON" }, origin); }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const invitation = typeof input.invitation === "string" ? input.invitation.trim() : "";
  if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128 || invitation.length < 12) {
    return json(400, { error: "Invalid registration details" }, origin);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const tokenHash = await sha256(invitation);
  const { data: invite } = await admin.from("teacher_invitations")
    .select("id,school_id,email,expires_at,used_at")
    .eq("token_hash", tokenHash).maybeSingle();
  if (!invite || invite.used_at || invite.email !== email || new Date(invite.expires_at).getTime() <= Date.now()) {
    return json(400, { error: "Invitation is invalid, expired, or belongs to another email" }, origin);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (createError || !created.user) return json(400, { error: "Teacher account could not be created" }, origin);
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({ id: userId, email, name, role: "teacher" });
  const { error: memberError } = profileError ? { error: profileError } : await admin.from("school_members").insert({
    school_id: invite.school_id, user_id: userId, role: "teacher", active: true,
  });
  const { data: claimed, error: claimError } = memberError ? { data: null, error: memberError } : await admin
    .from("teacher_invitations")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", invite.id).is("used_at", null).select("id").maybeSingle();
  if (profileError || memberError || claimError || !claimed) {
    await admin.auth.admin.deleteUser(userId);
    console.error("Invited teacher provisioning rolled back", { invitationId: invite.id });
    return json(409, { error: "Invitation was already used or setup failed" }, origin);
  }
  return json(201, { registered: true }, origin);
});
