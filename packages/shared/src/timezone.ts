/**
 * Pure timezone helpers. Server and clients both use these so quiet-hour
 * logic and "send at 9am their time" arithmetic stays consistent.
 */

export function isValidIanaTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Hour (0-23) for a Date in the given IANA timezone. */
export function hourInTimezone(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // Intl returns "24" at midnight in some implementations; normalize.
  const n = parseInt(hour, 10);
  return n === 24 ? 0 : n;
}

/**
 * True if the given moment falls within the recipient's quiet hours.
 * Either bound may be null (means: no quiet hours).
 * Supports wraparound (e.g. 22..7).
 */
export function isQuietHour(
  date: Date,
  tz: string,
  quietStart: number | null,
  quietEnd: number | null,
): boolean {
  if (quietStart === null || quietEnd === null) return false;
  const h = hourInTimezone(date, tz);
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) {
    return h >= quietStart && h < quietEnd;
  }
  return h >= quietStart || h < quietEnd;
}

/**
 * Convert "send tomorrow at 9am in user's timezone" UI input to a UTC ISO
 * string suitable for storage in `scheduled_delivery_at`.
 *
 * Inputs are user-local calendar values; we resolve them in `tz` so DST
 * transitions land on the correct UTC instant.
 */
export function localDateTimeToUtcIso(
  year: number,
  month: number,   // 1-12
  day: number,     // 1-31
  hour: number,    // 0-23
  minute: number,  // 0-59
  tz: string,
): string {
  // Trick: compute the offset of the requested local time in `tz`, then
  // subtract from the naive UTC interpretation.
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const tzString = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(naiveUtc));

  const get = (t: string) => parseInt(tzString.find((p) => p.type === t)?.value ?? '0', 10);
  const tzedAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  );

  const offsetMs = tzedAsUtc - naiveUtc;
  return new Date(naiveUtc - offsetMs).toISOString();
}

/** Human-friendly relative phrasing for short delays. */
export function describeRelative(target: Date, from: Date = new Date()): string {
  const diffMs = target.getTime() - from.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 1) return 'now';
  if (Math.abs(minutes) < 60) return minutes > 0 ? `in ${minutes}m` : `${-minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `in ${hours}h` : `${-hours}h ago`;
  const days = Math.round(hours / 24);
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}
