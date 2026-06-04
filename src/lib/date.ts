// Pure date helpers — no DB/DOM deps, safe to unit test in isolation.

/**
 * ISO Monday (YYYY-MM-DD) of the week containing `d`.
 * Computed entirely in UTC so the result is deterministic regardless of the
 * runtime timezone — the CFR week key must be identical on every client/server.
 */
export function weekStart(d = new Date()): string {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7; // 0 = Monday
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}
