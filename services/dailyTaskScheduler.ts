import type { Habit, Task } from '../types';
import { todayDateKey } from '../utils/date';
import { taskRepository } from '../database/contentRepository';
import { createReminderFromTask, createTaskFromHabit, taskIdForHabitDay } from './taskFactory';
import { matchesSchedule } from '../utils/schedule';
import { cancelAlarmsForTask, upsertReminderWithAlarm } from './alarmScheduler';
import { openAlarmForTask } from './alarmService';
import { useDataStore } from '../features/data/dataStore';

function toneExtras(habit: Habit) {
  return {
    customToneUri: habit.reminder.customToneUri ?? null,
    customToneName: habit.reminder.customToneName ?? null,
  };
}

/**
 * If multiple tasks exist for the same habit on the same day (legacy race),
 * keep one actionable task and delete the rest + their device alarms.
 */
export async function dedupeTodayTasksForHabits(
  uid: string,
  tasks: Task[],
): Promise<Task[]> {
  const dateKey = todayDateKey();
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.habitId || task.scheduledDate !== dateKey) continue;
    const key = task.habitId;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  const removeIds = new Set<string>();

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    const canonicalId = taskIdForHabitDay(group[0]!.habitId!, dateKey);
    const preferred =
      group.find((t) => t.id === canonicalId) ??
      group.find((t) => t.status === 'pending' || t.status === 'snoozed') ??
      [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;

    for (const extra of group) {
      if (extra.id === preferred.id) continue;
      removeIds.add(extra.id);
      await cancelAlarmsForTask(uid, extra.id);
      await taskRepository.removeByUser(uid, extra.id);
    }
  }

  if (removeIds.size) {
    const { tasks: local, setTasks } = useDataStore.getState();
    setTasks(local.filter((t) => !removeIds.has(t.id)));
  }

  return tasks.filter((t) => !removeIds.has(t.id));
}

export async function ensureDailyTasksForHabits(
  uid: string,
  habits: Habit[],
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  // Always re-read from Firestore so we don't race a concurrent HabitsScreen write.
  const fromDb = await taskRepository.listForDate(uid, dateKey);
  const merged = new Map<string, Task>();
  for (const t of [...existingTasks, ...fromDb]) merged.set(t.id, t);
  let tasks = await dedupeTodayTasksForHabits(uid, Array.from(merged.values()));

  const active = habits.filter((h) => h.status === 'active' && h.reminder.enabled);
  for (const habit of active) {
    if (!matchesSchedule(habit.repeatRule, dateKey)) continue;
    const already = tasks.some(
      (t) => t.habitId === habit.id && t.scheduledDate === dateKey,
    );
    if (already) continue;

    const task = createTaskFromHabit(habit, dateKey);
    await taskRepository.upsert(uid, task);
    const reminder = createReminderFromTask(task, habit.reminder.toneId, toneExtras(habit));
    const saved = await upsertReminderWithAlarm(uid, reminder);
    tasks = [...tasks, task];
    if (!saved.notificationId && new Date(saved.scheduledAt).getTime() <= Date.now()) {
      await openAlarmForTask(task.id, 'overdue', saved);
    }
  }
}

/**
 * Reconcile today's task after a habit is created or edited.
 * Safe to call from HabitsScreen and from the habit subscription.
 */
export async function syncTodayTaskForHabit(
  uid: string,
  habit: Habit,
  existingTasks: Task[],
): Promise<void> {
  const dateKey = todayDateKey();
  const fromDb = await taskRepository.listForDate(uid, dateKey);
  const merged = new Map<string, Task>();
  for (const t of [...existingTasks, ...fromDb]) merged.set(t.id, t);
  const tasks = await dedupeTodayTasksForHabits(uid, Array.from(merged.values()));

  const existing = tasks.find(
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

  if (!existing) return;

  // Completed / skipped history stays; still cancel any orphan duplicate alarms.
  if (existing.status !== 'pending' && existing.status !== 'snoozed') return;

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

  await cancelAlarmsForTask(uid, existing.id);
  const refreshed: Task = {
    ...existing,
    scheduledTime: habit.reminder.time,
    title: habit.title,
    description: habit.description,
    category: habit.category,
    priority: habit.priority,
  };
  const reminder = createReminderFromTask(refreshed, habit.reminder.toneId, toneExtras(habit));
  await upsertReminderWithAlarm(uid, reminder);
}

/** Idempotent export helper for tests */
export function buildDailyTaskId(habitId: string, dateKey: string): string {
  return taskIdForHabitDay(habitId, dateKey);
}
