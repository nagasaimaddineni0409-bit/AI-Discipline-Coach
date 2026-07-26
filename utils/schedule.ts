import type { RepeatRule, ScheduleFrequency } from '../types';

export const WEEKDAYS: { index: number; short: string; label: string }[] = [
  { index: 0, short: 'Sun', label: 'Sunday' },
  { index: 1, short: 'Mon', label: 'Monday' },
  { index: 2, short: 'Tue', label: 'Tuesday' },
  { index: 3, short: 'Wed', label: 'Wednesday' },
  { index: 4, short: 'Thu', label: 'Thursday' },
  { index: 5, short: 'Fri', label: 'Friday' },
  { index: 6, short: 'Sat', label: 'Saturday' },
];

export const FREQUENCY_OPTIONS: { id: ScheduleFrequency; label: string }[] = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse a `YYYY-MM-DD` key into a UTC-midnight Date to avoid timezone drift. */
function keyToUtc(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToUtc(toKey).getTime() - keyToUtc(fromKey).getTime()) / MS_PER_DAY);
}

function monthsBetween(fromKey: string, toKey: string): number {
  const a = keyToUtc(fromKey);
  const b = keyToUtc(toKey);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Whether a habit/goal with this repeat rule is scheduled to occur on the given date. */
export function matchesSchedule(rule: RepeatRule, dateKey: string): boolean {
  const interval = Math.max(1, rule.interval || 1);
  const start = rule.startDate;

  if (start && dateKey < start) return false;
  if (rule.endDate && dateKey > rule.endDate) return false;

  switch (rule.frequency) {
    case 'once':
      return Boolean(start) && dateKey === start;

    case 'daily': {
      if (!start) return true;
      const diff = daysBetween(start, dateKey);
      return diff >= 0 && diff % interval === 0;
    }

    case 'weekly': {
      const dow = keyToUtc(dateKey).getUTCDay();
      const days = rule.daysOfWeek && rule.daysOfWeek.length ? rule.daysOfWeek : [dow];
      if (!days.includes(dow)) return false;
      if (!start || interval === 1) return true;
      const weeks = Math.floor(daysBetween(start, dateKey) / 7);
      return weeks >= 0 && weeks % interval === 0;
    }

    case 'monthly': {
      const day = keyToUtc(dateKey).getUTCDate();
      const target = rule.dayOfMonth ?? (start ? keyToUtc(start).getUTCDate() : day);
      if (day !== target) return false;
      if (!start || interval === 1) return true;
      const months = monthsBetween(start, dateKey);
      return months >= 0 && months % interval === 0;
    }

    case 'yearly': {
      if (!start) return true;
      const s = keyToUtc(start);
      const d = keyToUtc(dateKey);
      if (s.getUTCMonth() !== d.getUTCMonth() || s.getUTCDate() !== d.getUTCDate()) return false;
      const years = d.getUTCFullYear() - s.getUTCFullYear();
      return years >= 0 && years % interval === 0;
    }

    default:
      return false;
  }
}

function formatDateKey(dateKey?: string): string {
  if (!dateKey) return '';
  const d = keyToUtc(dateKey);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Human-readable summary, e.g. "Weekly on Mon, Wed" or "Once on Jul 30, 2026". */
export function describeSchedule(rule: RepeatRule): string {
  const interval = Math.max(1, rule.interval || 1);
  const every = interval > 1 ? `Every ${interval} ` : '';

  switch (rule.frequency) {
    case 'once':
      return rule.startDate ? `Once on ${formatDateKey(rule.startDate)}` : 'Once';
    case 'daily':
      return interval > 1 ? `${every}days` : 'Daily';
    case 'weekly': {
      const days = (rule.daysOfWeek ?? [])
        .slice()
        .sort((a, b) => a - b)
        .map((i) => WEEKDAYS[i]?.short)
        .filter(Boolean)
        .join(', ');
      const base = interval > 1 ? `${every}weeks` : 'Weekly';
      return days ? `${base} on ${days}` : base;
    }
    case 'monthly': {
      const day = rule.dayOfMonth ?? (rule.startDate ? keyToUtc(rule.startDate).getUTCDate() : 1);
      return `${interval > 1 ? `${every}months` : 'Monthly'} on day ${day}`;
    }
    case 'yearly':
      return interval > 1 ? `${every}years` : 'Yearly';
    default:
      return 'Custom';
  }
}
