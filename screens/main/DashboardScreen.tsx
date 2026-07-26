import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, FAB } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppCard } from '../../components/AppCard';
import { BdiCard } from '../../components/BdiCard';
import { ProgressRing } from '../../components/ProgressRing';
import { useDataStore } from '../../features/data/dataStore';
import { useAuthStore } from '../../features/auth/authStore';
import { MainTabParamList } from '../../navigation/types';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { useBrandPalette } from '../../hooks/useBrandPalette';
import { openAlarmForTask } from '../../services/alarmService';
import type { Task } from '../../types';

type Props = NativeStackScreenProps<MainTabParamList, 'Dashboard'>;

function isActionable(task: Task): boolean {
  return task.status === 'pending' || task.status === 'snoozed';
}

/** Prefer the chosen display name; never greet with a raw email address. */
function greetingName(profile: { displayName?: string; email?: string } | null): string {
  const name = profile?.displayName?.trim();
  if (name && !name.includes('@')) return name;
  return 'there';
}

export function DashboardScreen({ navigation }: Props) {
  const tasks = useDataStore((s) => s.tasks);
  const bdi = useDataStore((s) => s.bdi);
  const upcomingReminder = useDataStore((s) => s.upcomingReminder);
  const goals = useDataStore((s) => s.goals);
  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'active'),
    [goals],
  );
  const habits = useDataStore((s) => s.habits);
  const profile = useAuthStore((s) => s.profile);
  const palette = useBrandPalette();
  const [acting, setActing] = useState(false);

  // Dashboard only shows tasks for habits that still exist and are active (or goal tasks).
  const visibleTasks = useMemo(() => {
    const activeHabitIds = new Set(
      habits.filter((h) => h.status === 'active').map((h) => h.id),
    );
    return tasks.filter((t) => {
      if (!t.habitId) return true;
      return activeHabitIds.has(t.habitId);
    });
  }, [tasks, habits]);

  const completedCount = useMemo(
    () => visibleTasks.filter((t) => t.status === 'completed').length,
    [visibleTasks],
  );
  const skippedCount = useMemo(
    () => visibleTasks.filter((t) => t.status === 'skipped').length,
    [visibleTasks],
  );
  const pendingCount = useMemo(
    () => visibleTasks.filter((t) => isActionable(t)).length,
    [visibleTasks],
  );

  const todayProgress = useMemo(() => {
    if (!visibleTasks.length) return 0;
    return (completedCount / visibleTasks.length) * 100;
  }, [visibleTasks.length, completedCount]);

  const weeklyGoals = useMemo(() => activeGoals.filter((g) => g.period === 'weekly'), [activeGoals]);
  const monthlyGoals = useMemo(
    () => activeGoals.filter((g) => g.period === 'monthly'),
    [activeGoals],
  );

  const weeklyProgress = useMemo(() => {
    if (!weeklyGoals.length) return 0;
    return (
      weeklyGoals.reduce((acc, g) => acc + Math.min(100, (g.progress / g.target) * 100), 0) /
      weeklyGoals.length
    );
  }, [weeklyGoals]);

  const monthlyProgress = useMemo(() => {
    if (!monthlyGoals.length) return 0;
    return (
      monthlyGoals.reduce((acc, g) => acc + Math.min(100, (g.progress / g.target) * 100), 0) /
      monthlyGoals.length
    );
  }, [monthlyGoals]);

  // Next reminder only when its task is still actionable — keeps Upcoming in sync with Act.
  const upcomingTask = useMemo(() => {
    if (!upcomingReminder) return null;
    const task = visibleTasks.find((t) => t.id === upcomingReminder.taskId);
    if (!task || !isActionable(task)) return null;
    return task;
  }, [upcomingReminder, visibleTasks]);

  const activeHabits = useMemo(
    () => habits.filter((h) => h.status === 'active').slice(0, 4),
    [habits],
  );

  async function openAct(task: Task) {
    if (!isActionable(task) || acting) return;
    setActing(true);
    try {
      await openAlarmForTask(task.id, 'manual');
    } finally {
      setActing(false);
    }
  }

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall">Hello, {greetingName(profile)}</Text>
        <Text variant="bodyMedium" style={styles.sub}>
          Today&apos;s discipline overview
        </Text>

        <View style={styles.row}>
          <ProgressRing progress={todayProgress} label="Today" />
          <View style={styles.side}>
            <BdiCard
              score={bdi?.score ?? profile?.bdiScore ?? 0}
              weeklyChange={bdi?.weeklyChange ?? profile?.bdiWeeklyDelta ?? 0}
              monthlyChange={bdi?.monthlyChange ?? profile?.bdiMonthlyDelta ?? 0}
            />
            <Button
              mode="text"
              textColor={palette.accentText}
              compact
              onPress={() => navigation.navigate('Reports')}
              style={styles.reportLink}
            >
              View detailed report
            </Button>
          </View>
        </View>

        <AppCard>
          <Text variant="titleMedium">Today&apos;s progress</Text>
          <Text variant="bodyLarge">{Math.round(todayProgress)}% tasks completed</Text>
          <Text variant="bodyMedium">
            {completedCount} done · {skippedCount} skipped · {pendingCount} left
          </Text>
          <Text variant="bodyMedium">Weekly goals {Math.round(weeklyProgress)}%</Text>
          <Text variant="bodyMedium">Monthly goals {Math.round(monthlyProgress)}%</Text>
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Next reminder</Text>
          {upcomingReminder && upcomingTask ? (
            <>
              <Text variant="bodyLarge">{upcomingReminder.title}</Text>
              <Text variant="bodySmall">
                {new Date(upcomingReminder.scheduledAt).toLocaleString()}
              </Text>
              <Button
                mode="contained"
                buttonColor={palette.accent}
                textColor={palette.onAccent}
                style={styles.cardAction}
                contentStyle={styles.goalBtnContent}
                labelStyle={styles.goalBtnLabel}
                onPress={() => openAct(upcomingTask)}
                disabled={acting}
              >
                Act
              </Button>
            </>
          ) : (
            <Text variant="bodyMedium">No upcoming reminders</Text>
          )}
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Today&apos;s tasks</Text>
          {visibleTasks.length === 0 ? (
            <Text variant="bodyMedium">
              No tasks scheduled. Create a habit to generate daily tasks.
            </Text>
          ) : (
            visibleTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskMeta}>
                  <Text variant="bodyLarge">{task.title}</Text>
                  <Text variant="labelSmall">
                    {task.scheduledTime} · {task.status}
                  </Text>
                </View>
                {isActionable(task) ? (
                  <Button compact onPress={() => openAct(task)} disabled={acting}>
                    Act
                  </Button>
                ) : null}
              </View>
            ))
          )}
        </AppCard>

        <AppCard>
          <Text variant="titleMedium">Goal progress</Text>
          {activeGoals.length === 0 ? (
            <>
              <Text variant="bodyMedium">
                No goals yet. Goals are separate from habits — use them for longer targets (weekly /
                monthly / yearly).
              </Text>
              {activeHabits.length ? (
                <Text variant="bodySmall" style={styles.habitHint}>
                  Active habits: {activeHabits.map((h) => h.title).join(', ')}
                </Text>
              ) : null}
              <Button
                mode="contained"
                buttonColor={palette.accent}
                textColor={palette.onAccent}
                style={styles.cardAction}
                contentStyle={styles.goalBtnContent}
                labelStyle={styles.goalBtnLabel}
                onPress={() => navigation.navigate('Goals')}
              >
                Create a goal
              </Button>
            </>
          ) : (
            activeGoals.slice(0, 4).map((goal) => (
              <View key={goal.id} style={styles.taskRow}>
                <Text variant="bodyMedium">{goal.title}</Text>
                <Text variant="labelSmall">
                  {goal.progress}/{goal.target} ({goal.period})
                </Text>
              </View>
            ))
          )}
        </AppCard>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: palette.accent }]}
        color={palette.onAccent}
        onPress={() => navigation.navigate('Habits')}
        label="Add"
      />
    </ScreenScaffold>
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
  reportLink: {
    alignSelf: 'flex-start',
    marginTop: -4,
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
  cardAction: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 14,
  },
  goalBtnContent: {
    height: 44,
    paddingHorizontal: 8,
  },
  goalBtnLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  habitHint: {
    marginTop: 8,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
