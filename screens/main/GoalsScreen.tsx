import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, FAB, Portal, Text } from 'react-native-paper';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { EntityForm, EntityFormValues } from '../../components/EntityForm';
import { FormTextField } from '../../components/FormTextField';
import { goalFormSchemaFor } from '../../utils/validation';
import { buildGoalPayload } from '../../services/taskFactory';
import { goalRepository } from '../../database/contentRepository';
import { EntityCard } from '../../components/EntityCard';
import type { Goal, GoalPeriod, GoalKind, GoalStatus } from '../../types';
import { parseTimeToMinutes, todayDateKey } from '../../utils/date';
import { describeSchedule } from '../../utils/schedule';
import { goalToFormValues } from '../../utils/formValues';
import { ScreenScaffold } from '../../components/ScreenScaffold';

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
  customToneUri: null,
  customToneName: null,
  color: '#1E88E5',
  icon: 'briefcase',
  period: 'weekly',
  kind: 'recurring',
  target: '1',
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [1],
  startDate: todayDateKey(),
  endDate: null,
};

export function GoalsScreen() {
  const user = useAuthStore((s) => s.user);
  const goals = useDataStore((s) => s.goals);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [values, setValues] = useState(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  const sortedGoals = useMemo(
    () =>
      [...goals].sort(
        (a, b) => parseTimeToMinutes(a.reminder.time) - parseTimeToMinutes(b.reminder.time),
      ),
    [goals],
  );

  async function setGoalStatus(goal: Goal, status: GoalStatus) {
    if (!user) return;
    const updated = { ...goal, status, updatedAt: new Date().toISOString() };
    await goalRepository.upsert(user.uid, updated);
    useDataStore.getState().setGoals(
      useDataStore.getState().goals.map((g) => (g.id === goal.id ? updated : g)),
    );
  }

  async function deleteGoal(goal: Goal) {
    if (!user) return;
    await goalRepository.removeByUser(user.uid, goal.id);
    useDataStore.getState().setGoals(useDataStore.getState().goals.filter((g) => g.id !== goal.id));
  }

  function startCreate() {
    setEditing(null);
    setValues(defaultValues);
    setErrors({});
    setCreating(true);
  }

  function startEdit(goal: Goal) {
    setEditing(goal);
    setValues(goalToFormValues(goal));
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
    const parsed = goalFormSchemaFor(editing?.repeatRule?.startDate).safeParse({
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
      // The schedule frequency drives the goal period/kind for consistency.
      const derivedPeriod: GoalPeriod =
        values.frequency === 'once' ? values.period : values.frequency;
      const derivedKind: GoalKind = values.frequency === 'once' ? 'one_time' : values.kind;
      const goal = buildGoalPayload(user.uid, {
        title: values.title,
        description: values.description,
        category: values.category,
        customCategoryLabel: values.customCategoryLabel,
        period: derivedPeriod,
        kind: derivedKind,
        priority: values.priority,
        reminderTime: values.reminderTime,
        reminderEnabled: values.reminderEnabled,
        toneId: values.toneId,
        customToneUri: values.customToneUri,
        customToneName: values.customToneName,
        color: values.color,
        icon: values.icon,
        target: Number(values.target),
        notes: values.notes,
        schedule: {
          frequency: values.frequency,
          interval: values.interval,
          daysOfWeek: values.daysOfWeek,
          startDate: values.startDate,
          endDate: values.endDate,
        },
      }, editing ?? undefined);
      await goalRepository.upsert(user.uid, goal);
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
          submitLabel={editing ? 'Update goal' : 'Save goal'}
          loading={loading}
          onCancel={closeForm}
          originalStartDate={editing?.repeatRule?.startDate}
          extraFields={
            <>
              {values.frequency !== 'once' ? (
                <>
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
                </>
              ) : null}
              <FormTextField
                label="Target (times to reach the goal)"
                value={values.target}
                onChangeText={(target) => setValues((v) => ({ ...v, target }))}
                keyboardType="numeric"
                style={{ marginTop: 12 }}
              />
            </>
          }
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <FlatList
        contentContainerStyle={styles.list}
        data={sortedGoals}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No goals yet.</Text>}
        renderItem={({ item }) => (
          <EntityCard
            status={item.status}
            title={item.title}
            onEdit={() => startEdit(item)}
            onPause={() => setGoalStatus(item, 'paused')}
            onResume={() => setGoalStatus(item, 'active')}
            onArchive={() => setGoalStatus(item, 'archived')}
            onDelete={() => setPendingDelete(item)}
          >
            <Text variant="titleMedium">
              {item.title}
              {item.status !== 'active' ? ` · ${item.status}` : ''}
            </Text>
            <Text variant="bodySmall">
              {item.period} · {item.kind} · {item.category}
            </Text>
            <Text variant="bodySmall">{describeSchedule(item.repeatRule)}</Text>
            <Text variant="bodyMedium">
              Progress {item.progress}/{item.target}
            </Text>
          </EntityCard>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={startCreate} label="Goal" />

      <Portal>
        <Dialog visible={Boolean(pendingDelete)} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>Delete goal?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              “{pendingDelete?.title}” will be permanently removed. This can’t be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              onPress={async () => {
                if (pendingDelete) await deleteGoal(pendingDelete);
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
