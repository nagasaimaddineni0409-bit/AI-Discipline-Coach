import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Reminder } from '../types';
import { reminderRepository } from '../database/contentRepository';
import { ensureAlarmPermissions, warnIfAlarmMayBeBlocked } from './alarmPermissions';

export const ALARM_CHANNEL_ID = 'discipline-alarms';

/**
 * High-priority local-notification channel.
 *
 * Important: this is NOT the phone Clock / AlarmClock app. Expo schedules an
 * OS local notification (AlarmManager under the hood when exact alarms are
 * allowed). Without SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM + notification
 * permission, Android may delay or drop the fire time when the app is closed.
 */
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
    // Bundled via expo-notifications plugin (see app.json). Filename without path.
    sound: 'alarm_default.wav',
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

/** Cancel every pending OS notification tagged with this taskId (covers orphaned duplicates). */
export async function cancelScheduledAlarmsForTask(taskId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => {
          const data = n.content.data as { taskId?: string; kind?: string } | undefined;
          return data?.kind === 'discipline_alarm' && data.taskId === taskId;
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Ignore — best-effort cleanup.
  }
}

/**
 * Schedule (or reschedule) a local OS notification for a reminder.
 * Uses a stable identifier (= reminder.id) so we can verify / cancel reliably.
 * Returns the Expo notification id, or null if already due / permissions blocked.
 */
export async function scheduleDeviceAlarm(reminder: Reminder): Promise<string | null> {
  if (reminder.status !== 'scheduled') return null;
  if (Platform.OS === 'web') return null;

  const when = new Date(reminder.scheduledAt);
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 1500) {
    // Already due — caller should open the in-app alarm immediately.
    return null;
  }

  const allowed = await ensureAlarmPermissions();
  if (!allowed) {
    return null;
  }

  await ensureAlarmChannel();
  // Cancel by stable id and any previously stored OS id.
  await cancelDeviceAlarm(reminder.id);
  await cancelDeviceAlarm(reminder.notificationId);
  await cancelScheduledAlarmsForTask(reminder.taskId);

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
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
        sound: 'alarm_default.wav',
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
    // First successful schedule: remind user to enable Alarms & reminders (Android 12+).
    warnIfAlarmMayBeBlocked();
    return notificationId;
  } catch (err) {
    console.warn('[alarmScheduler] Failed to schedule local notification', err);
    warnIfAlarmMayBeBlocked();
    return null;
  }
}

/** Persist a reminder and keep its device notification alarm in sync. */
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

/**
 * Re-verify every future scheduled reminder is actually registered with the OS.
 * Call on cold start / foreground — OEMs may drop pending notifications while
 * the app was killed.
 */
export async function ensureAllPendingAlarmsScheduled(uid: string): Promise<void> {
  if (Platform.OS === 'web') return;

  let pending: Notifications.NotificationRequest[] = [];
  try {
    pending = await Notifications.getAllScheduledNotificationsAsync();
  } catch {
    pending = [];
  }

  const pendingIds = new Set(pending.map((n) => n.identifier));
  const pendingReminderIds = new Set(
    pending
      .map((n) => (n.content.data as { reminderId?: string } | undefined)?.reminderId)
      .filter((id): id is string => Boolean(id)),
  );

  const scheduled = await reminderRepository.listScheduled(uid);
  const now = Date.now();

  for (const reminder of scheduled) {
    const when = new Date(reminder.scheduledAt).getTime();
    if (Number.isNaN(when) || when <= now + 1500) {
      // Past/due — recovery UI handles ringing; no need to schedule.
      continue;
    }

    const presentInOs =
      pendingIds.has(reminder.id) ||
      pendingReminderIds.has(reminder.id) ||
      (Boolean(reminder.notificationId) && pendingIds.has(reminder.notificationId!));

    if (!presentInOs || !reminder.notificationId) {
      try {
        await upsertReminderWithAlarm(uid, reminder);
      } catch (err) {
        console.warn('[alarmScheduler] Failed to reschedule reminder', reminder.id, err);
      }
    }
  }
}

export async function cancelReminderAlarm(
  uid: string,
  reminder: Reminder,
): Promise<void> {
  await cancelDeviceAlarm(reminder.id);
  await cancelDeviceAlarm(reminder.notificationId);
  if (reminder.status === 'scheduled') {
    await reminderRepository.patch(uid, reminder.id, {
      status: 'acted',
      notificationId: null,
    });
  }
}

export async function cancelAlarmsForTask(uid: string, taskId: string): Promise<void> {
  await cancelScheduledAlarmsForTask(taskId);
  const related = await reminderRepository.listForTask(uid, taskId);
  await Promise.all(
    related.map(async (r) => {
      await cancelDeviceAlarm(r.id);
      await cancelDeviceAlarm(r.notificationId);
      if (r.status === 'scheduled') {
        await reminderRepository.patch(uid, r.id, { status: 'acted', notificationId: null });
      }
    }),
  );
}
