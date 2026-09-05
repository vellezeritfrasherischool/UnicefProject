import { getSupabase } from "./supabase";
import { functionErrorMessage } from "./functionError";

export type AdminOverview = {
  school: { id: string; name: string; slug: string; active: boolean };
  members: Array<{ user_id: string; role: "teacher" | "school_admin"; active: boolean; created_at: string }>;
  profiles: Array<{ id: string; name: string; email: string }>;
  invitations: Array<{ id: string; email: string; expires_at: string; used_at: string | null; created_at: string }>;
  classes: Array<{ id: string; name: string; teacher_id: string; created_at: string }>;
  usageSummary: { requests30d: number; failed30d: number; inputChars30d: number; byOperation: Record<string, number> };
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("school-admin", { body });
  if (error) throw new Error(await functionErrorMessage(error, "Veprimi i administratorit dështoi."));
  return data as T;
}

export const adminService = {
  list: () => call<AdminOverview>({ action: "list" }),
  invite: (email: string) => call<{ code: string; email: string; expiresInDays: number }>({ action: "invite", email }),
  revokeInvitation: (id: string) => call<{ revoked: true }>({ action: "revoke-invitation", id }),
  deactivateTeacher: (userId: string) => call<{ deactivated: true }>({ action: "deactivate-teacher", userId }),
};
