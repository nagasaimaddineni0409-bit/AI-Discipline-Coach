import { AppState, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Reminder, Task } from '../types';
import { useAlarmStore } from '../features/alarm/alarmStore';
import { useDataStore } from '../features/data/dataStore';
import { reminderRepository, taskRepository } from '../database/contentRepository';
import { todayDateKey } from '../utils/date';
import { ensureAlarmChannel } from './alarmScheduler';

function isActionable(task: Task): boolean {
  return task.status === 'pending' || task.status === 'snoozed';
}

export async function openAlarmForTask(
  taskId: string,
  source: 'notification' | 'tap' | 'overdue' | 'manual',
  reminderHint?: Reminder | null,
): Promise<boolean> {
  const { tasks } = useDataStore.getState();
  let task = tasks.find((t) => t.id === taskId) ?? null;

  // Task may not be in today's store yet (e.g. app cold-start from notification).
  if (!task && reminderHint?.userId) {
    const dateKey = todayDateKey();
    const fromDb = await taskRepository.listForDate(reminderHint.userId, dateKey);
    task = fromDb.find((t) => t.id === taskId) ?? null;
  }

  if (!task || !isActionable(task)) return false;

  let reminder = reminderHint ?? null;
  if (!reminder || reminder.taskId !== taskId) {
    const related = await reminderRepository.listForTask(task.userId, taskId);
    reminder =
      related.find((r) => r.status === 'scheduled') ??
      related.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0] ??
      null;
  }

  if (!reminder) {
    // Synthesize a minimal reminder so the alarm UI still has tone metadata.
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
  return true;
}

/** If any scheduled reminder is overdue and its task is still actionable, ring now. */
export async function ringOverdueAlarms(uid: string): Promise<void> {
  const now = Date.now();
  const upcoming = await reminderRepository.listUpcoming(uid, 20);
  // listUpcoming filters scheduledAt >= now; also scan today's tasks for missed ones.
  const { tasks, habits } = useDataStore.getState();
  const activeHabitIds = new Set(habits.filter((h) => h.status === 'active').map((h) => h.id));

  for (const task of tasks) {
    if (!isActionable(task)) continue;
    if (task.habitId && !activeHabitIds.has(task.habitId)) continue;

    const related = await reminderRepository.listForTask(uid, task.id);
    const due = related
      .filter((r) => r.status === 'scheduled')
      .find((r) => new Date(r.scheduledAt).getTime() <= now + 2000);

    if (due) {
      await openAlarmForTask(task.id, 'overdue', due);
      return; // One alarm at a time.
    }

    // No reminder doc but snoozedUntil passed.
    if (task.status === 'snoozed' && task.snoozedUntil && new Date(task.snoozedUntil).getTime() <= now) {
      await openAlarmForTask(task.id, 'overdue');
      return;
    }
  }

  // Also check reminders that listUpcoming might miss if clock skew.
  void upcoming;
}

export function startAlarmListeners(): () => void {
  void ensureAlarmChannel();

  const received = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as {
      kind?: string;
      taskId?: string;
      reminderId?: string;
    };
    if (data?.kind !== 'discipline_alarm' || !data.taskId) return;
    void openAlarmForTask(data.taskId, 'notification');
  });

  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    const data = event.notification.request.content.data as {
      kind?: string;
      taskId?: string;
    };
    if (data?.kind !== 'discipline_alarm' || !data.taskId) return;
    void openAlarmForTask(data.taskId, 'tap');
  });

  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      Vibration.cancel();
    }
  });

  return () => {
    received.remove();
    response.remove();
    appState.remove();
  };
}
