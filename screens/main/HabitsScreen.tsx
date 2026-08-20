import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { EntityForm, EntityFormValues } from '../../components/EntityForm';
import { habitFormSchemaFor } from '../../utils/validation';
import { buildHabitPayload } from '../../services/taskFactory';
import { habitRepository } from '../../database/contentRepository';
import { EntityCard } from '../../components/EntityCard';
import { parseTimeToMinutes, todayDateKey } from '../../utils/date';
import { describeSchedule } from '../../utils/schedule';
import { habitToFormValues } from '../../utils/formValues';
import { syncTodayTaskForHabit } from '../../services/dailyTaskScheduler';
import { deleteHabitCascade, setHabitStatusCascade } from '../../services/habitLifecycle';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import type { GoalStatus, Habit } from '../../types';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import type { MainTabParamList } from '../../navigation/types';

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
  customToneUri: null,
  customToneName: null,
  color: '#E53935',
  icon: 'heart-pulse',
  frequency: 'daily',
  interval: 1,
  daysOfWeek: [1, 2, 3, 4, 5],
  startDate: todayDateKey(),
  endDate: null,
};

export function HabitsScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Habits'>>();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const habits = useDataStore((s) => s.habits);
  const tasks = useDataStore((s) => s.tasks);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [values, setValues] = useState<EntityFormValues>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);

  const sortedHabits = useMemo(
    () =>
      [...habits].sort(
        (a, b) => parseTimeToMinutes(a.reminder.time) - parseTimeToMinutes(b.reminder.time),
      ),
    [habits],
  );

  function startEdit(habit: Habit) {
    setEditing(habit);
    setValues(habitToFormValues(habit));
    setErrors({});
    setCreating(true);
  }

  // Open edit when Dashboard navigates here with editHabitId.
  useEffect(() => {
    const editHabitId = route.params?.editHabitId;
    if (!editHabitId) return;
    const habit = habits.find((h) => h.id === editHabitId);
    if (habit) startEdit(habit);
    navigation.setParams({ editHabitId: undefined } as never);
  }, [route.params?.editHabitId, habits, navigation]);

  async function setHabitStatus(habit: Habit, status: GoalStatus) {
    if (!user) return;
    await setHabitStatusCascade(user.uid, habit, status);
  }

  async function deleteHabit(habit: Habit) {
    if (!user) return;
    await deleteHabitCascade(user.uid, habit);
  }

  function startCreate() {
    setEditing(null);
    setValues(defaultValues);
    setErrors({});
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setValues(defaultValues);
    setErrors({});
  }

  async function onSubmit() {
    if (!user) return;
    setErrors({});
    const parsed = habitFormSchemaFor(editing?.repeatRule?.startDate).safeParse({
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
        customToneUri: values.customToneUri,
        customToneName: values.customToneName,
        color: values.color,
        icon: values.icon,
        schedule: {
          frequency: values.frequency,
          interval: values.interval,
          daysOfWeek: values.daysOfWeek,
          startDate: values.startDate,
          endDate: values.endDate,
        },
      }, editing ?? undefined);
      await habitRepository.upsert(user.uid, habit);
      // One path only: sync creates/updates today's task. Do not also create here —
      // the habit subscription runs ensureDailyTasksForHabits and that race caused duplicates.
      await syncTodayTaskForHabit(user.uid, habit, tasks);
      closeForm();
    } finally {
      setLoading(false);
    }
  }

  if (creating) {
    return (
      <ScreenScaffold>
        <EntityForm
          values={values}
          errors={errors}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          onSubmit={onSubmit}
          submitLabel={editing ? 'Update habit' : 'Save habit'}
          loading={loading}
          onCancel={closeForm}
          originalStartDate={editing?.repeatRule?.startDate}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <FlatList
        contentContainerStyle={styles.list}
        data={sortedHabits}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No habits yet. Tap + to create one.</Text>}
        renderItem={({ item }) => (
          <EntityCard
            status={item.status}
            title={item.title}
            onEdit={() => startEdit(item)}
            onPause={() => setHabitStatus(item, 'paused')}
            onResume={() => setHabitStatus(item, 'active')}
            onArchive={() => setHabitStatus(item, 'archived')}
            onDelete={() => setPendingDelete(item)}
          >
            <Text variant="titleMedium">
              {item.title}
              {item.status !== 'active' ? ` · ${item.status}` : ''}
            </Text>
            <Text variant="bodySmall">
              {item.category} · {item.reminder.time} · streak {item.streak}
            </Text>
            <Text variant="bodySmall">{describeSchedule(item.repeatRule)}</Text>
            <Text variant="bodyMedium">{item.description}</Text>
          </EntityCard>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={startCreate} label="Habit" />

      <Portal>
        <Dialog visible={Boolean(pendingDelete)} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete habit?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              “{pendingDelete?.title}” and its pending task for today will be removed. Completed
              history is kept. This can’t be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              onPress={async () => {
                if (pendingDelete) await deleteHabit(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.7 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
