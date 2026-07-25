import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Switch, Text, TextInput, Button } from 'react-native-paper';
import { AppCard } from '../../components/AppCard';
import { FirestoreRepository } from '../../database/baseRepository';
import { COLLECTIONS } from '../../firebase/config';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/featureFlags';
import type { FeatureFlags } from '../../types';

class AdminRepository extends FirestoreRepository {
  async getFlags(): Promise<FeatureFlags> {
    const doc = await this.get<FeatureFlags>(COLLECTIONS.adminFeatureFlags, 'global');
    return doc ?? DEFAULT_FEATURE_FLAGS;
  }

  async setFlags(flags: FeatureFlags) {
    await this.set(COLLECTIONS.adminFeatureFlags, 'global', flags);
  }

  async listCrashLogs() {
    return this.list<{ id: string; message: string; createdAt: string }>(
      COLLECTIONS.adminCrashLogs,
      [],
    );
  }
}

const adminRepository = new AdminRepository();

export function AdminScreen() {
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [crashes, setCrashes] = useState<{ id: string; message: string; createdAt: string }[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState('Loading…');

  useEffect(() => {
    adminRepository.getFlags().then(setFlags);
    adminRepository.listCrashLogs().then(setCrashes);
    setAnalyticsSummary('User analytics aggregate via Cloud Functions (adminGetAnalytics).');
  }, []);

  async function saveFlags() {
    await adminRepository.setFlags(flags);
  }

  function sendPushBroadcast() {
    // Cloud Function hook — client enqueues request document for backend worker
    adminRepository.set(`${COLLECTIONS.adminFeatureFlags}_push_queue`, Date.now().toString(), {
      title: pushTitle,
      body: pushBody,
      createdAt: new Date().toISOString(),
    });
    setPushTitle('');
    setPushBody('');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppCard>
        <Text variant="titleMedium">User analytics</Text>
        <Text variant="bodyMedium">{analyticsSummary}</Text>
      </AppCard>

      <AppCard>
        <Text variant="titleMedium">Crash logs</Text>
        {crashes.length === 0 ? (
          <Text variant="bodySmall">No crash logs recorded.</Text>
        ) : (
          crashes.slice(0, 10).map((c) => (
            <Text key={c.id} variant="bodySmall" style={styles.line}>
              {c.createdAt}: {c.message}
            </Text>
          ))
        )}
      </AppCard>

      <AppCard>
        <Text variant="titleMedium">Push notifications</Text>
        <TextInput label="Title" value={pushTitle} onChangeText={setPushTitle} />
        <TextInput label="Body" value={pushBody} onChangeText={setPushBody} />
        <Button mode="contained" onPress={sendPushBroadcast} style={styles.btn}>
          Queue broadcast
        </Button>
      </AppCard>

      <AppCard>
        <Text variant="titleMedium">Feature flags</Text>
        {Object.entries(flags).map(([key, value]) => (
          <Switch
            key={key}
            value={Boolean(value)}
            onValueChange={(v) => setFlags((f) => ({ ...f, [key]: v }))}
          />
        ))}
        <Text variant="labelSmall">{JSON.stringify(flags)}</Text>
        <Button mode="outlined" onPress={saveFlags} style={styles.btn}>
          Save flags
        </Button>
        <Text variant="bodySmall" style={styles.note}>
          Premium billing flag remains disabled in Version 1.
        </Text>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  line: { marginTop: 4 },
  btn: { marginTop: 8 },
  note: { marginTop: 8, opacity: 0.7 },
});
