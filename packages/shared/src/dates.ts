/** Format a Date (or ISO string) as Canvas cartridge datetime: YYYY-MM-DDThh:mm:ss (no ms, no zone). */
export function toCartridgeDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${String(value)}`);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Normalize a spec datetime (which may omit seconds) to full YYYY-MM-DDThh:mm:ss. */
export function normalizeSpecDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

/** Minutes east of UTC for an IANA time zone at a given instant. */
function timeZoneOffsetMinutes(timestamp: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - timestamp) / 60_000;
}

/**
 * Interpret a naive spec datetime (YYYY-MM-DDThh:mm[:ss]) as wall-clock time in
 * an IANA time zone and return the equivalent UTC datetime (same shape, no zone
 * suffix). Canvas reads cartridge datetimes as UTC, so "23:59 Amsterdam" must be
 * written as "21:59" (or "22:59" in winter) for imports to match teacher intent.
 */
export function localDateTimeToUtc(naive: string, timeZone: string): string {
  const normalized = normalizeSpecDate(naive);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`invalid datetime: ${naive}`);
  const [, y, mo, d, h, mi, s] = match.map(Number) as [number, ...number[]];
  const wallClockAsUtc = Date.UTC(y as number, (mo as number) - 1, d, h, mi, s);
  // Two passes to converge across DST boundaries.
  let timestamp = wallClockAsUtc;
  for (let i = 0; i < 2; i++) {
    timestamp = wallClockAsUtc - timeZoneOffsetMinutes(timestamp, timeZone) * 60_000;
  }
  return new Date(timestamp).toISOString().slice(0, 19);
}
