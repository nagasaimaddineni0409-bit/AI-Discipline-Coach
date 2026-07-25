import type { SnoozeDurationMinutes, Task } from '../types';
import {
  behaviourEventRepository,
  taskRepository,
  reminderRepository,
} from '../database/contentRepository';
import { buildBehaviourEvent, updateStreakAfterCompletion } from '../services/behaviourEngine';
import { habitRepository } from '../database/contentRepository';
import { userRepository } from '../database/userRepository';
import { calculateBdi, computeConsistency } from '../services/bdiService';
import { useDataStore } from '../features/data/dataStore';

export async function completeTask(task: Task, afterSnooze = false): Promise<void> {
  const now = new Date().toISOString();
  const scheduledAt = `${task.scheduledDate}T${task.scheduledTime}:00.000Z`;
  await taskRepository.patch(task.userId, task.id, {
    status: 'completed',
    completedAt: now,
  });

  let streak = 0;
  if (task.habitId) {
    const habits = await habitRepository.listByUser(task.userId);
    const habit = habits.find((h) => h.id === task.habitId);
    if (habit) {
      const result = updateStreakAfterCompletion(habit.streak, true);
      streak = result.streak;
      await habitRepository.upsert(task.userId, {
        ...habit,
        streak: result.streak,
        longestStreak: Math.max(habit.longestStreak, result.streak),
      });
    }
  }

  const event = buildBehaviourEvent({
    userId: task.userId,
    action: afterSnooze ? 'completed_after_snooze' : 'completed',
    scheduledAt,
    taskId: task.id,
    habitId: task.habitId,
    goalId: task.goalId,
    goalCategory: task.category,
    streakAtEvent: streak,
    streakBroken: false,
    completionPercent: 100,
  });
  await behaviourEventRepository.append(task.userId, event);
  await refreshBdi(task.userId);
}

export async function skipTask(task: Task): Promise<void> {
  const scheduledAt = `${task.scheduledDate}T${task.scheduledTime}:00.000Z`;
  await taskRepository.patch(task.userId, task.id, { status: 'skipped' });

  let streakBroken = false;
  let streak = 0;
  if (task.habitId) {
    const habits = await habitRepository.listByUser(task.userId);
    const habit = habits.find((h) => h.id === task.habitId);
    if (habit) {
      const result = updateStreakAfterCompletion(habit.streak, false);
      streakBroken = result.broken;
      streak = result.streak;
      await habitRepository.upsert(task.userId, { ...habit, streak: result.streak });
    }
  }

  const event = buildBehaviourEvent({
    userId: task.userId,
    action: 'skipped',
    scheduledAt,
    taskId: task.id,
    habitId: task.habitId,
    goalId: task.goalId,
    goalCategory: task.category,
    streakAtEvent: streak,
    streakBroken,
    completionPercent: 0,
  });
  await behaviourEventRepository.append(task.userId, event);
  await refreshBdi(task.userId);
}

export async function snoozeTask(
  task: Task,
  minutes: SnoozeDurationMinutes,
  reminderId?: string,
): Promise<void> {
  const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
  const scheduledAt = `${task.scheduledDate}T${task.scheduledTime}:00.000Z`;
  await taskRepository.patch(task.userId, task.id, {
    status: 'snoozed',
    snoozedUntil,
  });

  const reminder = {
    id: reminderId ?? `${task.id}_snooze_${Date.now()}`,
    userId: task.userId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    scheduledAt: snoozedUntil,
    toneId: 'default',
    status: 'scheduled' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await reminderRepository.upsert(task.userId, reminder);

  const event = buildBehaviourEvent({
    userId: task.userId,
    action: 'snoozed',
    scheduledAt,
    taskId: task.id,
    habitId: task.habitId,
    goalId: task.goalId,
    reminderId: reminder.id,
    snoozeMinutes: minutes,
    goalCategory: task.category,
    streakAtEvent: 0,
    streakBroken: false,
    completionPercent: 0,
  });
  await behaviourEventRepository.append(task.userId, event);
  await refreshBdi(task.userId);
}

async function refreshBdi(userId: string) {
  const events = await behaviourEventRepository.listRecent(userId, 90);
  const goals = await import('../database/contentRepository').then((m) =>
    m.goalRepository.listByUser(userId),
  );
  const goalCompletion =
    goals.filter((g) => g.progress >= g.target).length / Math.max(goals.length, 1);
  const weeklyFlags = events.slice(0, 50).map(() => true);
  const bdi = calculateBdi({
    events,
    goalCompletionRate: goalCompletion,
    dailyImprovement: 0,
    weeklyImprovement: 0,
    weeklyConsistency: computeConsistency(weeklyFlags),
    monthlyConsistency: computeConsistency(weeklyFlags),
  });
  await userRepository.updateBdi(userId, bdi.score, bdi.weeklyChange, bdi.monthlyChange);
  useDataStore.getState().setBdi(bdi);
  useDataStore.getState().setBehaviourEvents(events);
}
