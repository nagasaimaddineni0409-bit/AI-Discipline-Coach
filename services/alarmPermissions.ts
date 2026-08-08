import { Alert, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ALARM_CHANNEL_ID = 'discipline-alarms';

async function ensureChannel(): Promise<void> {
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

/**
 * Notification gates required before a DATE trigger can fire reliably.
 * This is NOT the system Clock app — Expo local notifications / AlarmManager.
 */
export async function ensureAlarmPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  await ensureChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowCriticalAlerts: false,
      },
    });
    status = asked.status;
  }

  if (status !== 'granted') {
    Alert.alert(
      'Notifications required',
      'Discipline AI needs notification permission to ring reminders. Enable notifications for this app in system Settings.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
    );
    return false;
  }

  return true;
}

/** Opens Android “Alarms & reminders” screen when the OS requires an explicit grant. */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return;
  }
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    await Linking.openSettings();
  }
}

let exactAlarmTipShown = false;

/** One tip per app session when scheduling may be blocked by OEM / Android 12+ rules. */
export function warnIfAlarmMayBeBlocked(): void {
  if (Platform.OS !== 'android' || exactAlarmTipShown) return;
  exactAlarmTipShown = true;
  Alert.alert(
    'Allow exact alarms',
    'On Android 12+, timed reminders need “Alarms & reminders” enabled for Discipline AI. Without it, the OS may delay or skip the alarm when the app is closed.\n\nAlso turn off battery optimization for this app if reminders still miss.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Open alarm settings', onPress: () => void openExactAlarmSettings() },
    ],
  );
}
