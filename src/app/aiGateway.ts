import { getSupabase, isSupabaseEnabled } from "./supabase";
import { functionErrorMessage } from "./functionError";

type AiOperation = "chat" | "speech" | "image";

/**
 * Calls the authenticated server-side AI gateway. The OpenAI credential never
 * enters the Vite bundle. AI is intentionally unavailable in offline demo mode.
 */
export async function invokeAi<T>(operation: AiOperation, payload: unknown): Promise<T> {
  if (!isSupabaseEnabled()) {
    throw new Error("Veçoritë AI kërkojnë lidhje të sigurt me Supabase.");
  }

  const { data, error } = await getSupabase().functions.invoke("ai-gateway", {
    body: { operation, payload },
  });

  if (error) {
    // Do not expose provider responses or internal stack traces to students.
    throw new Error(await functionErrorMessage(error, "Shërbimi AI nuk është i disponueshëm. Provo sërish."));
  }
  return data as T;
}
