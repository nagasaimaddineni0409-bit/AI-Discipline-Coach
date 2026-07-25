import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Alert } from 'react-native';
import { Button, List, Switch, Text } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { logoutUser, deleteAuthUser } from '../../firebase/auth';
import { userRepository } from '../../database/userRepository';
import { cacheClearAll } from '../../services/cacheService';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/featureFlags';
import type { ThemeMode } from '../../types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { settings, load, setTheme, patch } = useSettingsStore();

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  async function onTheme(theme: ThemeMode) {
    if (!user) return;
    await setTheme(user.uid, theme);
  }

  async function exportData() {
    Alert.alert(
      'Export queued',
      'Data export will be delivered via Cloud Functions when premium export is enabled.',
    );
  }

  async function deleteAccount() {
    Alert.alert('Delete account', 'This permanently deletes your account and data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await userRepository.updateProfile(user.uid, { displayName: '[deleted]' });
          await cacheClearAll();
          await deleteAuthUser();
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="titleMedium">Theme</Text>
      <List.Item
        title="Light"
        onPress={() => onTheme('light')}
        right={() => (settings?.theme === 'light' ? <List.Icon icon="check" /> : null)}
      />
      <List.Item
        title="Dark"
        onPress={() => onTheme('dark')}
        right={() => (settings?.theme === 'dark' ? <List.Icon icon="check" /> : null)}
      />
      <List.Item
        title="System"
        onPress={() => onTheme('system')}
        right={() => (settings?.theme === 'system' ? <List.Icon icon="check" /> : null)}
      />

      <Text variant="titleMedium" style={styles.section}>
        Notifications
      </Text>
      <List.Item
        title="Enable notifications"
        right={() => (
          <Switch
            value={settings?.notificationsEnabled ?? true}
            onValueChange={(notificationsEnabled) => {
              if (user) void patch(user.uid, { notificationsEnabled });
            }}
          />
        )}
      />
      <List.Item
        title="Reminder sounds"
        right={() => (
          <Switch
            value={settings?.reminderSoundsEnabled ?? true}
            onValueChange={(reminderSoundsEnabled) => {
              if (user) void patch(user.uid, { reminderSoundsEnabled });
            }}
          />
        )}
      />

      <Text variant="titleMedium" style={styles.section}>
        Account
      </Text>
      <List.Item
        title="Profile"
        description={profile?.email}
        onPress={() => navigation.navigate('Profile')}
      />
      <Button mode="outlined" onPress={exportData} style={styles.btn}>
        Export data
      </Button>
      <Button mode="outlined" onPress={() => navigation.navigate('Privacy')} style={styles.btn}>
        Privacy
      </Button>
      <Button mode="text" onPress={logoutUser} style={styles.btn}>
        Sign out
      </Button>
      <Button mode="contained-tonal" buttonColor="#B00020" onPress={deleteAccount} style={styles.btn}>
        Delete account
      </Button>

      {profile?.isAdmin && DEFAULT_FEATURE_FLAGS.adminPanel ? (
        <Button mode="contained" onPress={() => navigation.navigate('Admin')} style={styles.btn}>
          Admin panel
        </Button>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 16,
  },
  btn: {
    marginTop: 8,
  },
});
