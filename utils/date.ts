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
  return date.toISOString().slice(0, 10);
}

export function startOfWeek(date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

export function startOfMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
