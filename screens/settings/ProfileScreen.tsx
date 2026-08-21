import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { userRepository } from '../../database/userRepository';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { AppCard } from '../../components/AppCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({}: Props) {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!profile) return;
    setLoading(true);
    try {
      await userRepository.updateProfile(profile.uid, { displayName: displayName.trim() });
      await refreshProfile();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScaffold>
      <AppCard style={styles.card}>
        <Text variant="headlineSmall">Profile</Text>
        <TextInput
          label="Display name"
          mode="outlined"
          value={displayName}
          onChangeText={setDisplayName}
          style={styles.input}
        />
        <Text variant="bodyMedium" style={styles.meta}>
          Email: {profile?.email}
        </Text>
        <Text variant="bodyMedium">
          Streak: {profile?.currentStreakDays ?? 0} days
          {profile?.longestStreakDays
            ? ` (best ${profile.longestStreakDays})`
            : ''}
        </Text>
        <Text variant="bodySmall" style={styles.meta}>
          Days in a row with at least one completed reminder
        </Text>
        <Text variant="bodyMedium">BDI: {profile?.bdiScore ?? 0}</Text>
        <Button mode="contained" onPress={save} loading={loading} style={styles.btn}>
          Save
        </Button>
      </AppCard>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 16,
  },
  input: {
    marginTop: 12,
    marginBottom: 8,
  },
  meta: {
    opacity: 0.8,
    marginBottom: 4,
  },
  btn: {
    marginTop: 12,
  },
});
