import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from '../database/baseRepository';
import { ensureAlarmChannel } from '../services/alarmScheduler';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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
    // Local alarms still work without a push token (Expo Go / misconfigured projectId).
    return null;
  }
}
