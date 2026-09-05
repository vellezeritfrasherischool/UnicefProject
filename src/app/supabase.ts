import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";
const flag = (import.meta.env.VITE_USE_SUPABASE as string | undefined)?.trim().toLowerCase();

/** True when flag is on and credentials look configured. */
export function isSupabaseEnabled(): boolean {
  if (flag !== "true" && flag !== "1" && flag !== "yes") return false;
  if (!url || !anonKey) return false;
  if (url.includes("YOUR_PROJECT") || anonKey.includes("your-anon")) return false;
  return true;
}

export function getSupabaseUrl(): string {
  return url;
}

export function getSupabaseAnonKey(): string {
  return anonKey;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseEnabled()) {
    throw new Error(
      "Supabase nuk është aktiv. Vendos VITE_USE_SUPABASE=true dhe çelësat në .env, pastaj ristarto `npm run dev`."
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
