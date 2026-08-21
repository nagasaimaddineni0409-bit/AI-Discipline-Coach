import type { Reminder, SnoozeDurationMinutes, Task } from '../types';
import {
  behaviourEventRepository,
  taskRepository,
  reminderRepository,
  habitRepository,
  goalRepository,
} from '../database/contentRepository';
import { buildBehaviourEvent, updateStreakAfterCompletion } from '../services/behaviourEngine';
import { userRepository } from '../database/userRepository';
import {
  calculateBdi,
  computeConsistency,
  buildDailyCompletionFlags,
  computeCurrentStreakDays,
} from '../services/bdiService';
import { useDataStore } from '../features/data/dataStore';
import { localDateTimeIso } from '../utils/date';
import { cancelAlarmsForTask, upsertReminderWithAlarm } from './alarmScheduler';
import { useAlarmStore } from '../features/alarm/alarmStore';
import { useAuthStore } from '../features/auth/authStore';

function isActionable(task: Task): boolean {
  return task.status === 'pending' || task.status === 'snoozed';
}

/** Keep the local task list in sync immediately (before Firestore snapshot arrives). */
function patchLocalTask(taskId: string, patch: Partial<Task>) {
  const { tasks, setTasks } = useDataStore.getState();
  setTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)));
}

/** Mark every scheduled reminder for this task as acted, then refresh "upcoming". */
async function settleRemindersForTask(userId: string, taskId: string): Promise<void> {
  await cancelAlarmsForTask(userId, taskId);
  await refreshUpcomingReminder(userId);
}

/** Pick the next reminder whose linked task is still actionable (today or lookahead). */
export async function refreshUpcomingReminder(userId: string): Promise<Reminder | null> {
  const candidates = await reminderRepository.listUpcoming(userId, 30);
  const { tasks, habits } = useDataStore.getState();
  const activeHabitIds = new Set(
    habits.filter((h) => h.status === 'active').map((h) => h.id),
  );
  const next =
    candidates.find((r) => {
      const task = tasks.find((t) => t.id === r.taskId);
      if (!task) {
        // Lookahead reminders: task may not be in today's store — still show them.
        return true;
      }
      if (task.status !== 'pending' && task.status !== 'snoozed') return false;
      if (task.habitId && !activeHabitIds.has(task.habitId)) return false;
      return true;
    }) ?? null;
  useDataStore.getState().setUpcomingReminder(next);
  return next;
}

export async function completeTask(task: Task, afterSnooze = false): Promise<void> {
  if (!isActionable(task)) return;

  const now = new Date().toISOString();
  const scheduledAt = localDateTimeIso(task.scheduledDate, task.scheduledTime);
  patchLocalTask(task.id, { status: 'completed', completedAt: now });
  await taskRepository.patch(task.userId, task.id, {
    status: 'completed',
    completedAt: now,
  });
  await cancelAlarmsForTask(task.userId, task.id);
  useAlarmStore.getState().clearAlarm();

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
  await settleRemindersForTask(task.userId, task.id);
  await refreshBdi(task.userId);
}

export async function skipTask(task: Task): Promise<void> {
  if (!isActionable(task)) return;

  const scheduledAt = localDateTimeIso(task.scheduledDate, task.scheduledTime);
  patchLocalTask(task.id, { status: 'skipped' });
  await taskRepository.patch(task.userId, task.id, { status: 'skipped' });
  await cancelAlarmsForTask(task.userId, task.id);
  useAlarmStore.getState().clearAlarm();

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
  await settleRemindersForTask(task.userId, task.id);
  await refreshBdi(task.userId);
}

export async function snoozeTask(
  task: Task,
  minutes: SnoozeDurationMinutes,
  reminderId?: string,
): Promise<void> {
  if (!isActionable(task)) return;

  const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
  const scheduledAt = localDateTimeIso(task.scheduledDate, task.scheduledTime);
  patchLocalTask(task.id, { status: 'snoozed', snoozedUntil });
  await taskRepository.patch(task.userId, task.id, {
    status: 'snoozed',
    snoozedUntil,
  });

  // Capture tone before we settle the previous reminders.
  const previous = await reminderRepository.listForTask(task.userId, task.id);
  const prior = previous
    .filter((r) => r.status === 'scheduled')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  // Previous scheduled reminders for this task are superseded by the snooze reminder.
  await cancelAlarmsForTask(task.userId, task.id);

  const reminder: Reminder = {
    id: reminderId ?? `${task.id}_snooze_${Date.now()}`,
    userId: task.userId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    scheduledAt: snoozedUntil,
    toneId: prior?.toneId ?? 'default',
    customToneUri: prior?.customToneUri ?? null,
    customToneName: prior?.customToneName ?? null,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await upsertReminderWithAlarm(task.userId, reminder);
  useAlarmStore.getState().clearAlarm();

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
  await refreshUpcomingReminder(task.userId);
  await refreshBdi(task.userId);
}

async function refreshBdi(userId: string) {
  const events = await behaviourEventRepository.listRecent(userId, 90);
  const goals = await goalRepository.listByUser(userId);
  const goalCompletion =
    goals.filter((g) => g.progress >= g.target).length / Math.max(goals.length, 1);
  const weeklyFlags = buildDailyCompletionFlags(events, 7);
  const monthlyFlags = buildDailyCompletionFlags(events, 90);
  const bdi = calculateBdi({
    events,
    goalCompletionRate: goalCompletion,
    weeklyConsistency: computeConsistency(weeklyFlags),
    monthlyConsistency: computeConsistency(buildDailyCompletionFlags(events, 30)),
  });
  const currentStreakDays = computeCurrentStreakDays(monthlyFlags);
  const profile = await userRepository.getProfile(userId);
  const longestStreakDays = Math.max(profile?.longestStreakDays ?? 0, currentStreakDays);
  await userRepository.updateBdi(userId, bdi.score, bdi.weeklyChange, bdi.monthlyChange, {
    currentStreakDays,
    longestStreakDays,
  });
  useDataStore.getState().setBdi(bdi);
  useDataStore.getState().setBehaviourEvents(events);
  // Keep Profile screen in sync without requiring re-login.
  const authProfile = useAuthStore.getState().profile;
  if (authProfile?.uid === userId) {
    useAuthStore.getState().setProfile({
      ...authProfile,
      bdiScore: bdi.score,
      bdiWeeklyDelta: bdi.weeklyChange,
      bdiMonthlyDelta: bdi.monthlyChange,
      currentStreakDays,
      longestStreakDays,
    });
  }
}
