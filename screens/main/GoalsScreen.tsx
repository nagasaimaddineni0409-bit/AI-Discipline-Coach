import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, FAB, Text, TextInput } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { EntityForm, EntityFormValues } from '../../components/EntityForm';
import { goalFormSchema } from '../../utils/validation';
import { buildGoalPayload } from '../../services/taskFactory';
import { goalRepository } from '../../database/contentRepository';
import { AppCard } from '../../components/AppCard';
import type { GoalPeriod, GoalKind } from '../../types';

const defaultValues: EntityFormValues & {
  period: GoalPeriod;
  kind: GoalKind;
  target: string;
} = {
  title: '',
  description: '',
  category: 'work',
  customCategoryLabel: '',
  priority: 'medium',
  notes: '',
  reminderTime: '09:00',
  reminderEnabled: true,
  toneId: 'default',
  color: '#1E88E5',
  icon: 'briefcase',
  period: 'weekly',
  kind: 'recurring',
  target: '1',
};

export function GoalsScreen() {
  const user = useAuthStore((s) => s.user);
  const goals = useDataStore((s) => s.goals);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!user) return;
    setErrors({});
    const parsed = goalFormSchema.safeParse({
      ...values,
      target: Number(values.target),
      reminderEnabled: values.reminderEnabled,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[String(issue.path[0] ?? 'form')] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const goal = buildGoalPayload(user.uid, {
        title: values.title,
        description: values.description,
        category: values.category,
        customCategoryLabel: values.customCategoryLabel,
        period: values.period,
        kind: values.kind,
        priority: values.priority,
        reminderTime: values.reminderTime,
        reminderEnabled: values.reminderEnabled,
        toneId: values.toneId,
        color: values.color,
        icon: values.icon,
        target: Number(values.target),
        notes: values.notes,
      });
      await goalRepository.upsert(user.uid, goal);
      setCreating(false);
      setValues(defaultValues);
    } finally {
      setLoading(false);
    }
  }

  if (creating) {
    return (
      <EntityForm
        values={values}
        errors={errors}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={onSubmit}
        submitLabel="Save goal"
        loading={loading}
        extraFields={
          <>
            <Text variant="labelLarge" style={{ marginTop: 16 }}>
              Period
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as GoalPeriod[]).map((period) => (
                <Button
                  key={period}
                  compact
                  mode={values.period === period ? 'contained' : 'outlined'}
                  onPress={() => setValues((v) => ({ ...v, period }))}
                >
                  {period}
                </Button>
              ))}
            </View>
            <Text variant="labelLarge" style={{ marginTop: 16 }}>
              Goal type
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['recurring', 'one_time'] as GoalKind[]).map((kind) => (
                <Button
                  key={kind}
                  compact
                  mode={values.kind === kind ? 'contained' : 'outlined'}
                  onPress={() => setValues((v) => ({ ...v, kind }))}
                >
                  {kind === 'one_time' ? 'One-time' : 'Recurring'}
                </Button>
              ))}
            </View>
            <TextInput
              label="Target"
              value={values.target}
              onChangeText={(target) => setValues((v) => ({ ...v, target }))}
              keyboardType="numeric"
              style={{ marginTop: 12 }}
            />
          </>
        }
      />
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        contentContainerStyle={styles.list}
        data={goals}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No goals yet.</Text>}
        renderItem={({ item }) => (
          <AppCard>
            <Text variant="titleMedium">{item.title}</Text>
            <Text variant="bodySmall">
              {item.period} · {item.kind} · {item.category}
            </Text>
            <Text variant="bodyMedium">
              Progress {item.progress}/{item.target}
            </Text>
          </AppCard>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setCreating(true)} label="Goal" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.7 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
