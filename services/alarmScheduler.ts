import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminder } from '../types';
import { reminderRepository } from '../database/contentRepository';

export const ALARM_CHANNEL_ID = 'discipline-alarms';

/** High-priority channel so habit alarms interrupt like a clock alarm as much as OS allows. */
export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
    name: 'Discipline Alarms',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: 'default',
  });
}

export async function cancelDeviceAlarm(notificationId?: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already fired or cancelled.
  }
}

/**
 * Schedule (or reschedule) the OS wake-up notification for a reminder.
 * Returns the Expo notification id so we can cancel it later.
 */
export async function scheduleDeviceAlarm(reminder: Reminder): Promise<string | null> {
  if (reminder.status !== 'scheduled') return null;

  const when = new Date(reminder.scheduledAt);
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 1500) {
    // Already due — caller should open the in-app alarm immediately.
    return null;
  }

  await ensureAlarmChannel();
  await cancelDeviceAlarm(reminder.notificationId);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ ${reminder.title}`,
      body: 'Alarm ringing — open to Complete, Skip, or Snooze. Your action builds your discipline score.',
      data: {
        taskId: reminder.taskId,
        reminderId: reminder.id,
        toneId: reminder.toneId,
        customToneUri: reminder.customToneUri ?? null,
        kind: 'discipline_alarm',
      },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      ...(Platform.OS === 'android' ? { channelId: ALARM_CHANNEL_ID } : {}),
    },
  });

  return notificationId;
}

/** Persist a reminder and keep its device alarm in sync. */
export async function upsertReminderWithAlarm(
  uid: string,
  reminder: Reminder,
): Promise<Reminder> {
  const notificationId = await scheduleDeviceAlarm(reminder);
  const next: Reminder = {
    ...reminder,
    notificationId,
    updatedAt: new Date().toISOString(),
  };
  await reminderRepository.upsert(uid, next);
  return next;
}

export async function cancelReminderAlarm(
  uid: string,
  reminder: Reminder,
): Promise<void> {
  await cancelDeviceAlarm(reminder.notificationId);
  if (reminder.status === 'scheduled') {
    await reminderRepository.patch(uid, reminder.id, {
      status: 'acted',
      notificationId: null,
    });
  }
}

export async function cancelAlarmsForTask(uid: string, taskId: string): Promise<void> {
  const related = await reminderRepository.listForTask(uid, taskId);
  await Promise.all(
    related.map(async (r) => {
      await cancelDeviceAlarm(r.notificationId);
      if (r.status === 'scheduled') {
        await reminderRepository.patch(uid, r.id, { status: 'acted', notificationId: null });
      }
    }),
  );
}
