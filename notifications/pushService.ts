import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from '../database/baseRepository';

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
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    })
  ).data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await pushRepository.saveToken(userId, token);
  return token;
}

export function listenForNotificationResponses(
  onReminderOpen: (taskId?: string) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const taskId = response.notification.request.content.data?.taskId as string | undefined;
    onReminderOpen(taskId);
  });
  return () => sub.remove();
}

export async function scheduleLocalReminder(input: {
  title: string;
  body: string;
  scheduledAt: Date;
  taskId: string;
  toneId: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: { taskId: input.taskId, toneId: input.toneId },
      sound: input.toneId === 'gentle' ? 'default' : true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.scheduledAt,
    },
  });
}
