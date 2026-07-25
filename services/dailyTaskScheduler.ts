import type { Habit, Task } from '../types';
import { todayDateKey, generateId } from '../utils/date';
import { taskRepository } from '../database/contentRepository';
import { createReminderFromTask, createTaskFromHabit } from './taskFactory';
import { reminderRepository } from '../database/contentRepository';

export async function ensureDailyTasksForHabits(
  uid: string,
  habits: Habit[],
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  const active = habits.filter((h) => h.status === 'active' && h.reminder.enabled);
  for (const habit of active) {
    const already = existingTasks.some(
      (t) => t.habitId === habit.id && t.scheduledDate === dateKey,
    );
    if (already) continue;
    const task = createTaskFromHabit(habit, dateKey);
    await taskRepository.upsert(uid, task);
    const reminder = createReminderFromTask(task, habit.reminder.toneId);
    await reminderRepository.upsert(uid, reminder);
  }
}

/** Idempotent export helper for tests */
export function buildDailyTaskId(habitId: string, dateKey: string): string {
  return `${habitId}_${dateKey}_${generateId().slice(-6)}`;
}
