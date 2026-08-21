import type { Habit, Task } from '../types';
import { addDaysToDateKey, todayDateKey } from '../utils/date';
import { taskRepository } from '../database/contentRepository';
import { createReminderFromTask, createTaskFromHabit, taskIdForHabitDay } from './taskFactory';
import { matchesSchedule } from '../utils/schedule';
import { cancelAlarmsForTask, upsertReminderWithAlarm } from './alarmScheduler';
import { openAlarmForTask } from './alarmService';
import { useDataStore } from '../features/data/dataStore';

/** How many calendar days ahead to create tasks + OS alarms while the app is open. */
export const ALARM_LOOKAHEAD_DAYS = 7;

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

async function ensureTaskForHabitOnDate(
  uid: string,
  habit: Habit,
  dateKey: string,
  knownTasks: Task[],
): Promise<Task[]> {
  const already = knownTasks.some(
    (t) => t.habitId === habit.id && t.scheduledDate === dateKey,
  );
  if (already) return knownTasks;
  if (!matchesSchedule(habit.repeatRule, dateKey)) return knownTasks;

  // Confirm against Firestore for this day (lookahead days may not be in the today store).
  const fromDb = await taskRepository.listForDate(uid, dateKey);
  if (fromDb.some((t) => t.habitId === habit.id)) {
    return [...knownTasks, ...fromDb.filter((t) => !knownTasks.some((k) => k.id === t.id))];
  }

  const task = createTaskFromHabit(habit, dateKey);
  await taskRepository.upsert(uid, task);
  const reminder = createReminderFromTask(task, habit.reminder.toneId, toneExtras(habit));
  const saved = await upsertReminderWithAlarm(uid, reminder);
  if (!saved.notificationId && new Date(saved.scheduledAt).getTime() <= Date.now()) {
    // Only ring overdue for *today* — future dates should always schedule.
    if (dateKey === todayDateKey()) {
      await openAlarmForTask(task.id, 'overdue', saved);
    }
  }
  return [...knownTasks, task];
}

/**
 * Create today's habit tasks AND pre-schedule the next several days so
 * Android DATE notifications exist while the app is closed overnight.
 */
export async function ensureDailyTasksForHabits(
  uid: string,
  habits: Habit[],
  existingTasks: Task[],
): Promise<void> {
  const today = todayDateKey();
  const fromDb = await taskRepository.listForDate(uid, today);
  const merged = new Map<string, Task>();
  for (const t of [...existingTasks, ...fromDb]) merged.set(t.id, t);
  let tasks = await dedupeTodayTasksForHabits(uid, Array.from(merged.values()));

  const active = habits.filter((h) => h.status === 'active' && h.reminder.enabled);
  for (let offset = 0; offset <= ALARM_LOOKAHEAD_DAYS; offset++) {
    const dateKey = addDaysToDateKey(today, offset);
    for (const habit of active) {
      tasks = await ensureTaskForHabitOnDate(uid, habit, dateKey, tasks);
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
  const today = todayDateKey();
  const fromDb = await taskRepository.listForDate(uid, today);
  const merged = new Map<string, Task>();
  for (const t of [...existingTasks, ...fromDb]) merged.set(t.id, t);
  let tasks = await dedupeTodayTasksForHabits(uid, Array.from(merged.values()));

  const canSchedule = habit.status === 'active' && habit.reminder.enabled;

  if (!canSchedule) {
    // Cancel pending tasks in the lookahead window for this habit.
    for (let offset = 0; offset <= ALARM_LOOKAHEAD_DAYS; offset++) {
      const dateKey = addDaysToDateKey(today, offset);
      const dayTasks = await taskRepository.listForDate(uid, dateKey);
      for (const existing of dayTasks.filter((t) => t.habitId === habit.id)) {
        if (existing.status !== 'pending' && existing.status !== 'snoozed') continue;
        await cancelAlarmsForTask(uid, existing.id);
        await taskRepository.removeByUser(uid, existing.id);
      }
    }
    return;
  }

  for (let offset = 0; offset <= ALARM_LOOKAHEAD_DAYS; offset++) {
    const dateKey = addDaysToDateKey(today, offset);
    const scheduled = matchesSchedule(habit.repeatRule, dateKey);
    const dayTasks =
      dateKey === today
        ? tasks
        : await taskRepository.listForDate(uid, dateKey);
    const existing = dayTasks.find((t) => t.habitId === habit.id && t.scheduledDate === dateKey);

    if (scheduled && !existing) {
      tasks = await ensureTaskForHabitOnDate(uid, habit, dateKey, tasks);
      continue;
    }

    if (!existing) continue;
    if (existing.status !== 'pending' && existing.status !== 'snoozed') continue;

    if (!scheduled) {
      await cancelAlarmsForTask(uid, existing.id);
      await taskRepository.removeByUser(uid, existing.id);
      continue;
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
}

/** Idempotent export helper for tests */
export function buildDailyTaskId(habitId: string, dateKey: string): string {
  return taskIdForHabitDay(habitId, dateKey);
}
