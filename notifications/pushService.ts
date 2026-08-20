import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { AppState, Platform } from 'react-native';
import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from '../database/baseRepository';
import { ensureAlarmChannel } from '../services/alarmScheduler';

/**
 * Foreground alarm notifications: hide the tray beep and let AlarmRingHost
 * play the looping Clock-style tone instead.
 * Background / killed: still show + sound so the device wakes the user.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { kind?: string } | undefined;
    const isAlarm = data?.kind === 'discipline_alarm';
    const foreground = AppState.currentState === 'active';

    if (isAlarm && foreground) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

class PushRepository extends FirestoreRepository {
  saveToken(userId: string, token: string) {
    return this.update(COLLECTIONS.settings, userId, {
      pushToken: token,
      updatedAt: new Date().toISOString(),
    });
  }
}

const pushRepository = new PushRepository();

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice && Platform.OS !== 'web') return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  await ensureAlarmChannel();

  try {
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      })
    ).data;
    await pushRepository.saveToken(userId, token);
    return token;
  } catch {
    // Local alarms still work without a push token.
    return null;
  }
}
