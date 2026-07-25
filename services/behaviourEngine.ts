import type {
  BehaviourAction,
  BehaviourEvent,
  HabitCategory,
  GoalPeriod,
  SnoozeDurationMinutes,
} from '../types';
import { generateId, minutesBetween } from '../utils/date';

export interface RecordBehaviourParams {
  userId: string;
  action: BehaviourAction;
  scheduledAt: string;
  actedAt?: string;
  taskId?: string;
  habitId?: string;
  goalId?: string;
  reminderId?: string;
  snoozeMinutes?: SnoozeDurationMinutes;
  goalType?: GoalPeriod;
  goalCategory: HabitCategory;
  streakAtEvent: number;
  streakBroken: boolean;
  completionPercent: number;
  metadata?: Record<string, string | number | boolean>;
}

export function buildBehaviourEvent(params: RecordBehaviourParams): BehaviourEvent {
  const actedAt = params.actedAt ?? new Date().toISOString();
  const delayMinutes = Math.max(0, minutesBetween(params.scheduledAt, actedAt));

  return {
    id: generateId(),
    userId: params.userId,
    taskId: params.taskId,
    habitId: params.habitId,
    goalId: params.goalId,
    reminderId: params.reminderId,
    action: params.action,
    scheduledAt: params.scheduledAt,
    actedAt,
    delayMinutes,
    snoozeMinutes: params.snoozeMinutes,
    goalType: params.goalType,
    goalCategory: params.goalCategory,
    streakAtEvent: params.streakAtEvent,
    streakBroken: params.streakBroken,
    completionPercent: params.completionPercent,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  };
}

export function updateStreakAfterCompletion(
  currentStreak: number,
  completedOnSchedule: boolean,
): { streak: number; broken: boolean } {
  if (completedOnSchedule) {
    return { streak: currentStreak + 1, broken: false };
  }
  return { streak: 0, broken: currentStreak > 0 };
}
