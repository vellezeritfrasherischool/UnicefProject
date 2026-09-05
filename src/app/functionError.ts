/** Extracts a safe message returned by our Edge Functions. */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (typeof error === "object" && error && "context" in error) {
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      try {
        const body = await response.clone().json() as { error?: unknown };
        if (typeof body.error === "string" && body.error.length <= 240) return body.error;
      } catch { /* response was not JSON */ }
    }
  }
  return fallback;
}

