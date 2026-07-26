/** Reminder times are stored as 24h `HH:mm` (e.g. "14:30") and shown as 12h with AM/PM. */

export function parseHHmm(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hours: 8, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

export function toHHmm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function hhmmToDate(value: string, base = new Date()): Date {
  const { hours, minutes } = parseHHmm(value);
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function dateToHHmm(date: Date): string {
  return toHHmm(date.getHours(), date.getMinutes());
}

/** e.g. "08:00" → "8:00 AM", "14:30" → "2:30 PM" */
export function formatHHmmTo12Hour(value: string): string {
  const { hours, minutes } = parseHHmm(value);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function from12HourParts(
  hour12: number,
  minutes: number,
  period: 'AM' | 'PM',
): string {
  let hours = hour12 % 12;
  if (period === 'PM') hours += 12;
  return toHHmm(hours, minutes);
}

export function to12HourParts(value: string): {
  hour12: number;
  minutes: number;
  period: 'AM' | 'PM';
} {
  const { hours, minutes } = parseHHmm(value);
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { hour12, minutes, period };
}
