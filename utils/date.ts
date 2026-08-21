export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesBetween(isoA: string, isoB: string): number {
  return Math.round((new Date(isoB).getTime() - new Date(isoA).getTime()) / 60000);
}

export function todayDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Shift a YYYY-MM-DD key by N local calendar days. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return todayDateKey(dt);
}

/**
 * Build a Date from a local calendar day + HH:mm.
 * Never append "Z" — that would treat the wall-clock time as UTC.
 */
export function localDateTimeFromKey(dateKey: string, timeHHmm: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = timeHHmm.split(':').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

/** ISO string for a local date+time (includes the device offset, not a forced Z). */
export function localDateTimeIso(dateKey: string, timeHHmm: string): string {
  return localDateTimeFromKey(dateKey, timeHHmm).toISOString();
}

export function startOfWeek(date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return todayDateKey(d);
}

export function startOfMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}
