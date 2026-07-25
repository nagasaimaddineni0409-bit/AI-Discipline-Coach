import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, FAB, Text } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { EntityForm, EntityFormValues } from '../../components/EntityForm';
import { habitFormSchema } from '../../utils/validation';
import { buildHabitPayload, createReminderFromTask, createTaskFromHabit } from '../../services/taskFactory';
import { habitRepository, taskRepository, reminderRepository } from '../../database/contentRepository';
import { AppCard } from '../../components/AppCard';

const defaultValues: EntityFormValues = {
  title: '',
  description: '',
  category: 'health',
  customCategoryLabel: '',
  priority: 'medium',
  notes: '',
  reminderTime: '08:00',
  reminderEnabled: true,
  toneId: 'default',
  color: '#E53935',
  icon: 'heart-pulse',
};

export function HabitsScreen() {
  const user = useAuthStore((s) => s.user);
  const habits = useDataStore((s) => s.habits);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<EntityFormValues>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!user) return;
    setErrors({});
    const parsed = habitFormSchema.safeParse({
      ...values,
      reminderEnabled: values.reminderEnabled,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? 'form');
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const habit = buildHabitPayload(user.uid, {
        title: values.title,
        description: values.description,
        category: values.category,
        customCategoryLabel: values.customCategoryLabel,
        priority: values.priority,
        notes: values.notes,
        reminderTime: values.reminderTime,
        reminderEnabled: values.reminderEnabled,
        toneId: values.toneId,
        color: values.color,
        icon: values.icon,
      });
      await habitRepository.upsert(user.uid, habit);
      const task = createTaskFromHabit(habit);
      await taskRepository.upsert(user.uid, task);
      if (habit.reminder.enabled) {
        const reminder = createReminderFromTask(task, habit.reminder.toneId);
        await reminderRepository.upsert(user.uid, reminder);
      }
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
        submitLabel="Save habit"
        loading={loading}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        contentContainerStyle={styles.list}
        data={habits}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No habits yet. Tap + to create one.</Text>}
        renderItem={({ item }) => (
          <AppCard>
            <Text variant="titleMedium">{item.title}</Text>
            <Text variant="bodySmall">
              {item.category} · {item.reminder.time} · streak {item.streak}
            </Text>
            <Text variant="bodyMedium">{item.description}</Text>
          </AppCard>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setCreating(true)} label="Habit" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.7 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
