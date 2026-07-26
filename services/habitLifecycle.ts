import type { GoalStatus, Habit, Task } from '../types';
import { todayDateKey } from '../utils/date';
import {
  habitRepository,
  taskRepository,
} from '../database/contentRepository';
import { useDataStore } from '../features/data/dataStore';
import { refreshUpcomingReminder } from './reminderActions';
import { matchesSchedule } from '../utils/schedule';
import { createReminderFromTask, createTaskFromHabit } from './taskFactory';
import { cancelAlarmsForTask, upsertReminderWithAlarm } from './alarmScheduler';

async function settleRemindersForTasks(uid: string, taskIds: string[]): Promise<void> {
  await Promise.all(taskIds.map((taskId) => cancelAlarmsForTask(uid, taskId)));
}

/** Drop every one of today's tasks for a habit (any status) and settle their reminders. */
export async function removeTodayTasksForHabit(uid: string, habitId: string): Promise<void> {
  const dateKey = todayDateKey();
  const { tasks, setTasks } = useDataStore.getState();
  const todays = tasks.filter((t) => t.habitId === habitId && t.scheduledDate === dateKey);
  // Also catch tasks that may not be in the local store yet.
  const fromDb = await taskRepository.listForDate(uid, dateKey);
  const all = new Map<string, Task>();
  for (const t of [...todays, ...fromDb.filter((t) => t.habitId === habitId)]) {
    all.set(t.id, t);
  }
  const toRemove = Array.from(all.values());
  if (!toRemove.length) {
    await refreshUpcomingReminder(uid);
    return;
  }

  await settleRemindersForTasks(
    uid,
    toRemove.map((t) => t.id),
  );
  await Promise.all(toRemove.map((t) => taskRepository.removeByUser(uid, t.id)));

  const removeIds = new Set(toRemove.map((t) => t.id));
  setTasks(tasks.filter((t) => !removeIds.has(t.id)));
  await refreshUpcomingReminder(uid);
}

/** Fully delete a habit and scrub it from today's Dashboard (tasks + reminders). */
export async function deleteHabitCascade(uid: string, habit: Habit): Promise<void> {
  await removeTodayTasksForHabit(uid, habit.id);
  await habitRepository.removeByUser(uid, habit.id);

  const { habits, setHabits } = useDataStore.getState();
  setHabits(habits.filter((h) => h.id !== habit.id));
  await refreshUpcomingReminder(uid);
}

/** Pause / archive / resume — keep Dashboard tasks aligned with habit status. */
export async function setHabitStatusCascade(
  uid: string,
  habit: Habit,
  status: GoalStatus,
): Promise<void> {
  const updated: Habit = { ...habit, status, updatedAt: new Date().toISOString() };
  await habitRepository.upsert(uid, updated);

  const { habits, setHabits, tasks } = useDataStore.getState();
  setHabits(habits.map((h) => (h.id === habit.id ? updated : h)));

  const dateKey = todayDateKey();
  const shouldSchedule =
    status === 'active' &&
    updated.reminder.enabled &&
    matchesSchedule(updated.repeatRule, dateKey);

  if (!shouldSchedule) {
    await removeTodayTasksForHabit(uid, habit.id);
    return;
  }

  const existing = tasks.find((t) => t.habitId === habit.id && t.scheduledDate === dateKey);
  if (!existing) {
    const task = createTaskFromHabit(updated, dateKey);
    await taskRepository.upsert(uid, task);
    if (updated.reminder.enabled) {
      await upsertReminderWithAlarm(
        uid,
        createReminderFromTask(task, updated.reminder.toneId, {
          customToneUri: updated.reminder.customToneUri ?? null,
          customToneName: updated.reminder.customToneName ?? null,
        }),
      );
    }
    useDataStore.getState().setTasks([...useDataStore.getState().tasks, task]);
  }
  await refreshUpcomingReminder(uid);
}

/**
 * Remove orphan Dashboard tasks whose habit was deleted or is no longer active.
 * Runs after habit list sync so screens stay aligned even if a delete missed a task.
 */
export async function reconcileTasksWithHabits(
  uid: string,
  habits: Habit[],
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const orphans = existingTasks.filter((t) => {
    if (!t.habitId || t.scheduledDate !== dateKey) return false;
    const habit = byId.get(t.habitId);
    if (!habit) return true; // habit deleted
    if (habit.status !== 'active') return true; // paused / archived
    return false;
  });

  if (!orphans.length) return;

  await settleRemindersForTasks(
    uid,
    orphans.map((t) => t.id),
  );
  await Promise.all(orphans.map((t) => taskRepository.removeByUser(uid, t.id)));

  const removeIds = new Set(orphans.map((t) => t.id));
  const { tasks, setTasks } = useDataStore.getState();
  setTasks(tasks.filter((t) => !removeIds.has(t.id)));
  await refreshUpcomingReminder(uid);
}
