/**
 * Client-side network guards.
 *
 * Under heavy load a single stalled server call used to leave the whole screen
 * on a spinner forever. Every long-lived query should go through `raceTimeout`
 * so React Query gets a real error (and shows a retry button) instead of hanging.
 */
export function raceTimeout<T>(
  promise: Promise<T>,
  ms = 12_000,
  message = "সার্ভার দেরি করছে — আবার চেষ্টা করুন",
): Promise<T> {
  let id: any;
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id)) as Promise<T>;
}
