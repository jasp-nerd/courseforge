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
