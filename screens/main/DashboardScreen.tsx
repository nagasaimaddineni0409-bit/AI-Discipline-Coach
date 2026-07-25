import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, FAB } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { BdiCard } from '../../components/BdiCard';
import { ProgressRing } from '../../components/ProgressRing';
import { ReminderModal } from '../../components/ReminderModal';
import { useDataStore } from '../../features/data/dataStore';
import { useAuthStore } from '../../features/auth/authStore';
import { MainTabParamList } from '../../navigation/types';
import { completeTask, skipTask, snoozeTask } from '../../services/reminderActions';
import type { SnoozeDurationMinutes, Task } from '../../types';

type Props = NativeStackScreenProps<MainTabParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const tasks = useDataStore((s) => s.tasks);
  const bdi = useDataStore((s) => s.bdi);
  const upcomingReminder = useDataStore((s) => s.upcomingReminder);
  const goals = useDataStore((s) => s.goals);
  const profile = useAuthStore((s) => s.profile);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [reminderVisible, setReminderVisible] = useState(false);

  const todayProgress = useMemo(() => {
    if (!tasks.length) return 0;
    const done = tasks.filter((t) => t.status === 'completed').length;
    return (done / tasks.length) * 100;
  }, [tasks]);

  const weeklyProgress = useMemo(() => {
    if (!goals.length) return 0;
    const weekly = goals.filter((g) => g.period === 'weekly');
    if (!weekly.length) return todayProgress;
    return (
      weekly.reduce((acc, g) => acc + Math.min(100, (g.progress / g.target) * 100), 0) /
      weekly.length
    );
  }, [goals, todayProgress]);

  const monthlyProgress = useMemo(() => {
    const monthly = goals.filter((g) => g.period === 'monthly');
    if (!monthly.length) return weeklyProgress;
    return (
      monthly.reduce((acc, g) => acc + Math.min(100, (g.progress / g.target) * 100), 0) /
      monthly.length
    );
  }, [goals, weeklyProgress]);

  const reminderTask =
    activeTask ??
    (upcomingReminder ? tasks.find((t) => t.id === upcomingReminder.taskId) ?? null : null);

  function openReminder(task: Task) {
    setActiveTask(task);
    setReminderVisible(true);
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall">Hello, {profile?.displayName ?? 'there'}</Text>
        <Text variant="bodyMedium" style={styles.sub}>
          Today&apos;s discipline overview
        </Text>

        <View style={styles.row}>
          <ProgressRing progress={todayProgress} label="Today" />
          <View style={styles.side}>
            <BdiCard
              score={bdi?.score ?? profile?.bdiScore ?? 50}
              weeklyChange={bdi?.weeklyChange ?? profile?.bdiWeeklyDelta ?? 0}
              monthlyChange={bdi?.monthlyChange ?? profile?.bdiMonthlyDelta ?? 0}
            />
          </View>
        </View>

        <AppCard>
          <Text variant="titleMedium">Today&apos;s progress</Text>
          <Text variant="bodyLarge">{Math.round(todayProgress)}% tasks completed</Text>
          <Text variant="bodyMedium">Weekly {Math.round(weeklyProgress)}%</Text>
          <Text variant="bodyMedium">Monthly {Math.round(monthlyProgress)}%</Text>
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Upcoming reminder</Text>
          {upcomingReminder ? (
            <>
              <Text variant="bodyLarge">{upcomingReminder.title}</Text>
              <Text variant="bodySmall">{new Date(upcomingReminder.scheduledAt).toLocaleString()}</Text>
              {reminderTask ? (
                <Button mode="contained-tonal" onPress={() => reminderTask && openReminder(reminderTask)}>
                  Open reminder
                </Button>
              ) : null}
            </>
          ) : (
            <Text variant="bodyMedium">No upcoming reminders</Text>
          )}
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Today&apos;s tasks</Text>
          {tasks.length === 0 ? (
            <Text variant="bodyMedium">No tasks scheduled. Create a habit to generate daily tasks.</Text>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskMeta}>
                  <Text variant="bodyLarge">{task.title}</Text>
                  <Text variant="labelSmall">
                    {task.scheduledTime} · {task.status}
                  </Text>
                </View>
                {task.status === 'pending' || task.status === 'snoozed' ? (
                  <Button compact onPress={() => openReminder(task)}>
                    Act
                  </Button>
                ) : null}
              </View>
            ))
          )}
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Goal progress</Text>
          {goals.slice(0, 4).map((goal) => (
            <View key={goal.id} style={styles.taskRow}>
              <Text variant="bodyMedium">{goal.title}</Text>
              <Text variant="labelSmall">
                {goal.progress}/{goal.target} ({goal.period})
              </Text>
            </View>
          ))}
          {!goals.length ? <Text variant="bodyMedium">No goals yet.</Text> : null}
        </AppCard>
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('Habits' as never)}
        label="Add"
      />

      {reminderTask ? (
        <ReminderModal
          task={reminderTask}
          visible={reminderVisible}
          onDismiss={() => {
            setReminderVisible(false);
            setActiveTask(null);
          }}
          onComplete={async () => {
            await completeTask(reminderTask, reminderTask.status === 'snoozed');
            setReminderVisible(false);
            setActiveTask(null);
          }}
          onSkip={async () => {
            await skipTask(reminderTask);
            setReminderVisible(false);
            setActiveTask(null);
          }}
          onSnooze={async (minutes: SnoozeDurationMinutes) => {
            await snoozeTask(reminderTask, minutes);
            setReminderVisible(false);
            setActiveTask(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 16,
    paddingBottom: 96,
  },
  sub: {
    marginBottom: 16,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  side: {
    flex: 1,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  taskMeta: {
    flex: 1,
    paddingRight: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
