import type { Habit, Task } from '../types';
import { todayDateKey, generateId } from '../utils/date';
import { taskRepository, reminderRepository } from '../database/contentRepository';
import { createReminderFromTask, createTaskFromHabit } from './taskFactory';
import { matchesSchedule } from '../utils/schedule';
import { cancelAlarmsForTask, upsertReminderWithAlarm } from './alarmScheduler';
import { openAlarmForTask } from './alarmService';

function toneExtras(habit: Habit) {
  return {
    customToneUri: habit.reminder.customToneUri ?? null,
    customToneName: habit.reminder.customToneName ?? null,
  };
}

export async function ensureDailyTasksForHabits(
  uid: string,
  habits: Habit[],
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  const active = habits.filter((h) => h.status === 'active' && h.reminder.enabled);
  for (const habit of active) {
    // Only create a task when today matches the habit's repeat rule.
    if (!matchesSchedule(habit.repeatRule, dateKey)) continue;
    const already = existingTasks.some(
      (t) => t.habitId === habit.id && t.scheduledDate === dateKey,
    );
    if (already) continue;
    const task = createTaskFromHabit(habit, dateKey);
    await taskRepository.upsert(uid, task);
    const reminder = createReminderFromTask(task, habit.reminder.toneId, toneExtras(habit));
    const saved = await upsertReminderWithAlarm(uid, reminder);
    // If the habit time is already past for today, ring immediately.
    if (!saved.notificationId && new Date(saved.scheduledAt).getTime() <= Date.now()) {
      await openAlarmForTask(task.id, 'overdue', saved);
    }
  }
}

/**
 * Reconcile today's task after a habit is edited: create it if the new schedule
 * now includes today, drop it if it no longer does, or refresh its details.
 * Completed/skipped tasks are left alone so history stays intact.
 */
export async function syncTodayTaskForHabit(
  uid: string,
  habit: Habit,
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  const existing = existingTasks.find(
    (t) => t.habitId === habit.id && t.scheduledDate === dateKey,
  );
  const scheduled =
    habit.status === 'active' &&
    habit.reminder.enabled &&
    matchesSchedule(habit.repeatRule, dateKey);

  if (scheduled && !existing) {
    const task = createTaskFromHabit(habit, dateKey);
    await taskRepository.upsert(uid, task);
    const reminder = createReminderFromTask(task, habit.reminder.toneId, toneExtras(habit));
    const saved = await upsertReminderWithAlarm(uid, reminder);
    if (!saved.notificationId && new Date(saved.scheduledAt).getTime() <= Date.now()) {
      await openAlarmForTask(task.id, 'overdue', saved);
    }
    return;
  }

  if (!existing || existing.status !== 'pending') return;

  if (!scheduled) {
    await cancelAlarmsForTask(uid, existing.id);
    await taskRepository.removeByUser(uid, existing.id);
    return;
  }

  await taskRepository.patch(uid, existing.id, {
    title: habit.title,
    description: habit.description,
    category: habit.category,
    priority: habit.priority,
    scheduledTime: habit.reminder.time,
  });

  // Reschedule the device alarm for the new time / tone.
  await cancelAlarmsForTask(uid, existing.id);
  const refreshed: Task = { ...existing, scheduledTime: habit.reminder.time, title: habit.title };
  const reminder = createReminderFromTask(refreshed, habit.reminder.toneId, toneExtras(habit));
  await upsertReminderWithAlarm(uid, reminder);
}

/** Idempotent export helper for tests */
export function buildDailyTaskId(habitId: string, dateKey: string): string {
  return `${habitId}_${dateKey}_${generateId().slice(-6)}`;
}
