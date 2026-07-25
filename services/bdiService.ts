import type { BehaviourEvent, BdiSnapshot } from '../types';
import { clamp } from '../utils/date';

export interface BdiInput {
  events: BehaviourEvent[];
  goalCompletionRate: number;
  dailyImprovement: number;
  weeklyImprovement: number;
  weeklyConsistency: number;
  monthlyConsistency: number;
}

function rate(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

export function calculateBdi(input: BdiInput): BdiSnapshot {
  const total = input.events.length || 1;
  const completed = input.events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  ).length;
  const skipped = input.events.filter((e) => e.action === 'skipped').length;
  const snoozed = input.events.filter((e) => e.action === 'snoozed').length;
  const late = input.events.filter(
    (e) =>
      (e.action === 'completed' || e.action === 'completed_after_snooze') &&
      e.delayMinutes > 15,
  ).length;

  const taskCompletion = rate(completed, total);
  const skipRate = rate(skipped, total);
  const snoozeRate = rate(snoozed, total);
  const lateCompletion = rate(late, Math.max(completed, 1));
  const consistency = (input.weeklyConsistency + input.monthlyConsistency) / 2;

  const components = {
    taskCompletion: taskCompletion * 100,
    skipRate: (1 - skipRate) * 100,
    snoozeRate: (1 - snoozeRate) * 100,
    consistency: consistency * 100,
    lateCompletion: (1 - lateCompletion) * 100,
    goalCompletion: input.goalCompletionRate * 100,
    dailyImprovement: clamp(50 + input.dailyImprovement * 50, 0, 100),
    weeklyImprovement: clamp(50 + input.weeklyImprovement * 50, 0, 100),
  };

  const raw =
    components.taskCompletion * 0.22 +
    components.skipRate * 0.12 +
    components.snoozeRate * 0.1 +
    components.consistency * 0.18 +
    components.lateCompletion * 0.08 +
    components.goalCompletion * 0.15 +
    components.dailyImprovement * 0.075 +
    components.weeklyImprovement * 0.075;

  const score = Math.round(clamp(raw, 0, 100));

  return {
    score,
    weeklyChange: Math.round(input.weeklyImprovement * 10),
    monthlyChange: Math.round(input.dailyImprovement * 8),
    components,
    calculatedAt: new Date().toISOString(),
  };
}

export function computeConsistency(dailyCompletionFlags: boolean[]): number {
  if (!dailyCompletionFlags.length) return 0;
  const completedDays = dailyCompletionFlags.filter(Boolean).length;
  return completedDays / dailyCompletionFlags.length;
}
