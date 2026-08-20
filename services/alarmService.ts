import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Reminder, Task } from '../types';
import { useAlarmStore } from '../features/alarm/alarmStore';
import { useDataStore } from '../features/data/dataStore';
import { useAuthStore } from '../features/auth/authStore';
import { reminderRepository, taskRepository } from '../database/contentRepository';
import { todayDateKey } from '../utils/date';
import { ensureAlarmChannel } from './alarmScheduler';

function isActionable(task: Task): boolean {
  return task.status === 'pending' || task.status === 'snoozed';
}

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length) return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function readAlarmData(data: unknown): { taskId?: string; reminderId?: string } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const kind = readString(d.kind);
  const taskId = readString(d.taskId);
  if (!taskId) return null;
  // Android may stringify payload fields; accept missing kind if taskId is present.
  if (kind && kind !== 'discipline_alarm') return null;
  return { taskId, reminderId: readString(d.reminderId) };
}

function lastNotificationResponse(): Notifications.NotificationResponse | null {
  try {
    const sync = Notifications.getLastNotificationResponse?.();
    if (sync) return sync;
  } catch {
    // fall through to async callers
  }
  return null;
}

async function lastNotificationResponseAsync(): Promise<Notifications.NotificationResponse | null> {
  const sync = lastNotificationResponse();
  if (sync) return sync;
  try {
    return (await Notifications.getLastNotificationResponseAsync()) ?? null;
  } catch {
    return null;
  }
}

function clearHandledNotificationResponse(): void {
  try {
    Notifications.clearLastNotificationResponse?.();
  } catch {
    void Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
  }
}

async function resolveTask(taskId: string, hintUid?: string): Promise<Task | null> {
  const { tasks } = useDataStore.getState();
  const fromStore = tasks.find((t) => t.id === taskId);
  if (fromStore) return fromStore;

  const uid = hintUid ?? useAuthStore.getState().user?.uid ?? tasks[0]?.userId;
  if (!uid) return null;

  const dateKey = todayDateKey();
  const fromDb = await taskRepository.listForDate(uid, dateKey);
  return fromDb.find((t) => t.id === taskId) ?? null;
}

export async function openAlarmForTask(
  taskId: string,
  source: 'notification' | 'tap' | 'overdue' | 'manual',
  reminderHint?: Reminder | null,
): Promise<boolean> {
  const current = useAlarmStore.getState().active;
  if (current?.task.id === taskId) {
    useAlarmStore.getState().setPendingTaskId(null);
    return true;
  }

  const task = await resolveTask(taskId, reminderHint?.userId);
  if (!task || !isActionable(task)) {
    useAlarmStore.getState().setPendingTaskId(taskId);
    return false;
  }

  let reminder = reminderHint ?? null;
  if (!reminder || reminder.taskId !== taskId) {
    const related = await reminderRepository.listForTask(task.userId, taskId);
    reminder =
      related.find((r) => r.status === 'scheduled') ??
      related.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0] ??
      null;
  }

  if (!reminder) {
    reminder = {
      id: `ephemeral_${taskId}`,
      userId: task.userId,
      taskId: task.id,
      title: task.title,
      description: task.description,
      scheduledAt: new Date().toISOString(),
      toneId: 'default',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  useAlarmStore.getState().openAlarm({ task, reminder, source });
  clearHandledNotificationResponse();
  return true;
}

/** If any scheduled reminder is overdue and its task is still actionable, ring now. */
export async function ringOverdueAlarms(uid: string): Promise<void> {
  if (useAlarmStore.getState().active) return;

  const now = Date.now();
  const { tasks, habits } = useDataStore.getState();
  const activeHabitIds = new Set(habits.filter((h) => h.status === 'active').map((h) => h.id));

  let scheduled: Reminder[] = [];
  try {
    scheduled = await reminderRepository.listScheduled(uid);
  } catch {
    scheduled = [];
  }

  const dueReminder = scheduled.find((r) => new Date(r.scheduledAt).getTime() <= now + 2000);
  if (dueReminder) {
    const task = tasks.find((t) => t.id === dueReminder.taskId);
    if (!task || isActionable(task)) {
      if (task?.habitId && habits.length && !activeHabitIds.has(task.habitId)) {
        // skip inactive habit
      } else {
        const opened = await openAlarmForTask(dueReminder.taskId, 'overdue', dueReminder);
        if (opened) return;
      }
    }
  }

  for (const task of tasks) {
    if (!isActionable(task)) continue;
    if (task.habitId && activeHabitIds.size && !activeHabitIds.has(task.habitId)) continue;
    if (task.status === 'snoozed' && task.snoozedUntil && new Date(task.snoozedUntil).getTime() <= now) {
      await openAlarmForTask(task.id, 'overdue');
      return;
    }
  }
}

/**
 * Open the full-screen alarm if the app was launched from an alarm notification
 * (cold start / killed process).
 */
export async function recoverAlarmFromNotificationLaunch(): Promise<void> {
  try {
    const last = await lastNotificationResponseAsync();
    const data = readAlarmData(last?.notification.request.content.data);
    if (data?.taskId) {
      const opened = await openAlarmForTask(data.taskId, 'tap');
      if (opened) return;
    }

    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const d = readAlarmData(n.request.content.data);
      if (d?.taskId) {
        const opened = await openAlarmForTask(d.taskId, 'notification');
        if (opened) return;
      }
    }
  } catch {
    // ignore
  }
}

/** Call after Firestore tasks/reminders hydrate so a missed tap can still open the alarm. */
export async function flushAlarmsAfterDataReady(uid?: string): Promise<void> {
  if (useAlarmStore.getState().active) return;

  const userId = uid ?? useAuthStore.getState().user?.uid;
  const pending = useAlarmStore.getState().pendingTaskId;
  if (pending) {
    const opened = await openAlarmForTask(pending, 'tap');
    if (opened) return;
  }

  await recoverAlarmFromNotificationLaunch();
  if (useAlarmStore.getState().active) return;
  if (userId) await ringOverdueAlarms(userId);
}

let listenersStarted = false;

export function startAlarmListeners(): () => void {
  void ensureAlarmChannel();

  if (listenersStarted) {
    void flushAlarmsAfterDataReady();
    return () => undefined;
  }
  listenersStarted = true;

  const received = Notifications.addNotificationReceivedListener((notification) => {
    const data = readAlarmData(notification.request.content.data);
    if (!data?.taskId) return;
    useAlarmStore.getState().setPendingTaskId(data.taskId);
    void openAlarmForTask(data.taskId, 'notification');
  });

  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = readAlarmData(event.notification.request.content.data);
    if (!data?.taskId) return;
    useAlarmStore.getState().setPendingTaskId(data.taskId);
    void openAlarmForTask(data.taskId, 'tap');
  });

  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') return;
    if (useAlarmStore.getState().active) return;
    void flushAlarmsAfterDataReady();
  });

  void flushAlarmsAfterDataReady();

  return () => {
    listenersStarted = false;
    received.remove();
    response.remove();
    appState.remove();
  };
}
