import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { userRepository } from '../../database/userRepository';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

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
    <View style={styles.container}>
      <Text variant="headlineSmall">Profile</Text>
      <TextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
      <Text variant="bodyMedium" style={styles.meta}>
        Email: {profile?.email}
      </Text>
      <Text variant="bodyMedium">Streak: {profile?.currentStreakDays ?? 0} days</Text>
      <Text variant="bodyMedium">BDI: {profile?.bdiScore ?? 50}</Text>
      <Button mode="contained" onPress={save} loading={loading} style={styles.btn}>
        Save
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  meta: {
    opacity: 0.8,
  },
  btn: {
    marginTop: 8,
  },
});
