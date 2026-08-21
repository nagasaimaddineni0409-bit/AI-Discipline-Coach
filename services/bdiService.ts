import type { BehaviourEvent, BdiSnapshot } from '../types';
import { clamp } from '../utils/date';

export interface BdiInput {
  events: BehaviourEvent[];
  goalCompletionRate: number;
  weeklyConsistency: number;
  monthlyConsistency: number;
  /** Optional momentum signals; kept for backwards compatibility. */
  dailyImprovement?: number;
  weeklyImprovement?: number;
}

/**
 * How "disciplined" a single alarm/reminder interaction was, on a 0..1 scale.
 * This is the heart of the score: it is earned only by acting well on alarms.
 */
function eventQuality(e: BehaviourEvent): number {
  switch (e.action) {
    case 'completed':
      if (e.delayMinutes <= 15) return 1; // on time
      if (e.delayMinutes <= 60) return 0.75; // a bit late
      return 0.55; // very late but done
    case 'completed_after_snooze':
      return e.delayMinutes <= 60 ? 0.6 : 0.45; // done, but needed nudging
    case 'snoozed':
      return 0.2; // deferred, not acted on
    case 'skipped':
      return 0; // ignored
    default:
      return 0;
  }
}

function rate(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

/**
 * Penalty for chronic snoozing: tasks snoozed 3+ times before being handled.
 * Returns points (0..15) to subtract from the final score.
 */
function repeatedSnoozePenalty(events: BehaviourEvent[]): number {
  const snoozesByTask = new Map<string, number>();
  for (const e of events) {
    if (e.action !== 'snoozed' || !e.taskId) continue;
    snoozesByTask.set(e.taskId, (snoozesByTask.get(e.taskId) ?? 0) + 1);
  }
  let penalty = 0;
  for (const count of snoozesByTask.values()) {
    if (count >= 3) penalty += (count - 2) * 3; // 3rd snooze = 3pts, 4th = 6pts, ...
  }
  return Math.min(15, penalty);
}

const EMPTY_COMPONENTS: BdiSnapshot['components'] = {
  taskCompletion: 0,
  skipRate: 0,
  snoozeRate: 0,
  consistency: 0,
  lateCompletion: 0,
  goalCompletion: 0,
  dailyImprovement: 0,
  weeklyImprovement: 0,
};

export function calculateBdi(input: BdiInput): BdiSnapshot {
  const { events } = input;

  // No alarm activity yet -> nothing has been demonstrated -> score 0.
  if (!events.length) {
    return {
      score: 0,
      weeklyChange: 0,
      monthlyChange: 0,
      components: { ...EMPTY_COMPONENTS },
      calculatedAt: new Date().toISOString(),
    };
  }

  const total = events.length;
  const completed = events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  ).length;
  const skipped = events.filter((e) => e.action === 'skipped').length;
  const snoozed = events.filter((e) => e.action === 'snoozed').length;
  const late = events.filter(
    (e) =>
      (e.action === 'completed' || e.action === 'completed_after_snooze') && e.delayMinutes > 15,
  ).length;

  // Average behaviour quality across every alarm interaction (0..100).
  const behaviourQuality =
    (events.reduce((acc, e) => acc + eventQuality(e), 0) / total) * 100;

  const consistency = ((input.weeklyConsistency + input.monthlyConsistency) / 2) * 100;
  const goalCompletion = clamp(input.goalCompletionRate, 0, 1) * 100;

  const raw =
    behaviourQuality * 0.55 + // how well alarms were handled
    consistency * 0.3 + // showing up day after day
    goalCompletion * 0.15; // longer-term goal follow-through

  const score = Math.round(clamp(raw - repeatedSnoozePenalty(events), 0, 100));

  // Momentum: is the recent 7-day rhythm better than the 30-day baseline?
  const weeklyChange = Math.round((input.weeklyConsistency - input.monthlyConsistency) * 100);
  // Absolute 30-day completion rhythm (0–100), not a delta.
  const monthlyChange = Math.round(input.monthlyConsistency * 100);

  return {
    score,
    weeklyChange,
    monthlyChange,
    components: {
      taskCompletion: rate(completed, total) * 100,
      skipRate: rate(skipped, total) * 100,
      snoozeRate: rate(snoozed, total) * 100,
      consistency,
      lateCompletion: rate(late, Math.max(completed, 1)) * 100,
      goalCompletion,
      dailyImprovement: clamp(50 + (input.dailyImprovement ?? 0) * 50, 0, 100),
      weeklyImprovement: clamp(50 + (input.weeklyImprovement ?? 0) * 50, 0, 100),
    },
    calculatedAt: new Date().toISOString(),
  };
}

export function computeConsistency(dailyCompletionFlags: boolean[]): number {
  if (!dailyCompletionFlags.length) return 0;
  const completedDays = dailyCompletionFlags.filter(Boolean).length;
  return completedDays / dailyCompletionFlags.length;
}

/**
 * Consecutive days ending today (or yesterday if today has no completion yet)
 * with at least one completed alarm.
 */
export function computeCurrentStreakDays(dailyCompletionFlags: boolean[]): number {
  if (!dailyCompletionFlags.length) return 0;
  let end = dailyCompletionFlags.length - 1;
  // If today is still empty, count from yesterday so the streak doesn't drop midday.
  if (!dailyCompletionFlags[end] && end > 0) end -= 1;
  let streak = 0;
  for (let i = end; i >= 0; i--) {
    if (!dailyCompletionFlags[i]) break;
    streak += 1;
  }
  return streak;
}

/**
 * For each of the last `days` days, whether the user completed at least one
 * alarm/task that day. Used to measure consistency.
 */
export function buildDailyCompletionFlags(
  events: { createdAt: string; action: string }[],
  days: number,
): boolean[] {
  const flags: boolean[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => e.createdAt.startsWith(key));
    const completed = dayEvents.some(
      (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
    );
    flags.push(completed);
  }
  return flags;
}
