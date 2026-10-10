/** Run an external call up to `attempts` times. Throws the last error if all fail. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
