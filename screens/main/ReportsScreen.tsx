import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppCard } from '../../components/AppCard';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { generateWeeklyInsights, generateMonthlyTrendInsights } from '../../AI/insightsEngine';
import { todayDateKey, startOfWeek, startOfMonth } from '../../utils/date';
import { behaviourEventRepository } from '../../database/contentRepository';
import { useBrandPalette } from '../../hooks/useBrandPalette';
import type { BrandPalette } from '../../constants/theme';
import type { BehaviourAction, BehaviourEvent, Habit, Task } from '../../types';

type Tab = 'today' | 'history' | 'weekly' | 'monthly';

function actionLabel(action: BehaviourAction): string {
  switch (action) {
    case 'completed':
      return 'Completed';
    case 'completed_after_snooze':
      return 'Completed after snoozing';
    case 'skipped':
      return 'Skipped';
    case 'snoozed':
      return 'Snoozed';
    default:
      return action;
  }
}

function actionColor(action: BehaviourAction, palette: BrandPalette): string {
  switch (action) {
    case 'completed':
    case 'completed_after_snooze':
      return palette.success;
    case 'skipped':
      return palette.danger;
    case 'snoozed':
      return palette.warn;
    default:
      return palette.textMuted;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function eventTitle(event: BehaviourEvent, habits: Habit[], tasks: Task[]): string {
  if (event.habitId) {
    const habit = habits.find((h) => h.id === event.habitId);
    if (habit) return habit.title;
  }
  if (event.taskId) {
    const task = tasks.find((t) => t.id === event.taskId);
    if (task) return task.title;
  }
  return `${event.goalCategory} reminder`;
}

function countActions(events: BehaviourEvent[]) {
  return {
    completed: events.filter(
      (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
    ).length,
    skipped: events.filter((e) => e.action === 'skipped').length,
    snoozed: events.filter((e) => e.action === 'snoozed').length,
    total: events.length,
  };
}

export function ReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const behaviourEvents = useDataStore((s) => s.behaviourEvents);
  const setBehaviourEvents = useDataStore((s) => s.setBehaviourEvents);
  const bdi = useDataStore((s) => s.bdi);
  const tasks = useDataStore((s) => s.tasks);
  const habits = useDataStore((s) => s.habits);
  const palette = useBrandPalette();
  const [tab, setTab] = useState<Tab>('today');

  // Refresh activity history whenever Reports opens.
  useEffect(() => {
    if (!user) return;
    behaviourEventRepository
      .listRecent(user.uid, 90)
      .then(setBehaviourEvents)
      .catch(() => undefined);
  }, [user, setBehaviourEvents]);

  const score = bdi?.score ?? profile?.bdiScore ?? 0;
  const components = bdi?.components;

  const todayKey = todayDateKey();
  const todayEvents = useMemo(
    () => behaviourEvents.filter((e) => e.createdAt.startsWith(todayKey)),
    [behaviourEvents, todayKey],
  );
  const weekEvents = useMemo(() => {
    const start = startOfWeek();
    return behaviourEvents.filter((e) => e.createdAt >= `${start}T00:00:00.000Z`);
  }, [behaviourEvents]);
  const monthEvents = useMemo(() => {
    const month = startOfMonth();
    return behaviourEvents.filter((e) => e.createdAt >= `${month}T00:00:00.000Z`);
  }, [behaviourEvents]);

  const weeklyInsights = useMemo(() => generateWeeklyInsights(weekEvents), [weekEvents]);
  const monthlyInsights = useMemo(() => {
    const month = startOfMonth();
    const prevMonthDate = new Date(month);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevKey = startOfMonth(prevMonthDate);
    const previous = behaviourEvents.filter(
      (e) => e.createdAt >= `${prevKey}T00:00:00.000Z` && e.createdAt < `${month}T00:00:00.000Z`,
    );
    return generateMonthlyTrendInsights(monthEvents, previous);
  }, [behaviourEvents, monthEvents]);

  const history = useMemo(() => behaviourEvents.slice(0, 80), [behaviourEvents]);
  const todayStats = countActions(todayEvents);
  const weekStats = countActions(weekEvents);
  const monthStats = countActions(monthEvents);

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="bodyMedium" style={styles.intro}>
          Your discipline score comes from how you handle reminders. Open History to see every
          complete, skip, and snooze.
        </Text>

        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          style={styles.segments}
          buttons={[
            { value: 'today', label: 'Today' },
            { value: 'history', label: 'History' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
          theme={{
            colors: {
              secondaryContainer: palette.accent,
              onSecondaryContainer: palette.onAccent,
              outline: palette.cardBorder,
            },
          }}
        />

        {tab === 'today' ? (
          <>
            <AppCard featured>
              <Text variant="titleMedium">Discipline score</Text>
              <Text variant="displaySmall" style={styles.score}>
                {score}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                Based on reminder actions over recent days
              </Text>
              {components ? (
                <View style={styles.breakdown}>
                  <BreakdownRow label="Finishing tasks" value={Math.round(components.taskCompletion)} />
                  <BreakdownRow label="Avoiding skips" value={Math.round(100 - components.skipRate)} />
                  <BreakdownRow label="Avoiding snoozes" value={Math.round(100 - components.snoozeRate)} />
                  <BreakdownRow label="Showing up consistently" value={Math.round(components.consistency)} />
                </View>
              ) : (
                <Text variant="bodySmall" style={styles.muted}>
                  Act on reminders to unlock a score breakdown.
                </Text>
              )}
            </AppCard>

            <AppCard>
              <Text variant="titleMedium">Today&apos;s tasks</Text>
              {tasks.length === 0 ? (
                <Text variant="bodyMedium" style={styles.muted}>
                  No tasks scheduled for today. Create a habit to generate them.
                </Text>
              ) : (
                tasks.map((task) => (
                  <View key={task.id} style={styles.row}>
                    <View style={styles.rowBody}>
                      <Text variant="bodyLarge">{task.title}</Text>
                      <Text variant="labelSmall" style={styles.muted}>
                        {task.scheduledTime} · {task.status}
                        {task.completedAt
                          ? ` · done ${new Date(task.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                          : ''}
                      </Text>
                    </View>
                    <Text
                      variant="labelMedium"
                      style={{ color: statusColor(task.status, palette), textTransform: 'capitalize' }}
                    >
                      {task.status}
                    </Text>
                  </View>
                ))
              )}
            </AppCard>

            <AppCard>
              <Text variant="titleMedium">Today&apos;s actions</Text>
              <Text variant="bodyMedium" style={styles.statLine}>
                {todayStats.completed} completed · {todayStats.skipped} skipped ·{' '}
                {todayStats.snoozed} snoozed
              </Text>
              {todayEvents.length === 0 ? (
                <Text variant="bodySmall" style={styles.muted}>
                  No reminder actions yet today.
                </Text>
              ) : (
                todayEvents.map((event) => (
                  <HistoryRow
                    key={event.id}
                    event={event}
                    habits={habits}
                    tasks={tasks}
                  />
                ))
              )}
            </AppCard>
          </>
        ) : null}

        {tab === 'history' ? (
          <AppCard>
            <Text variant="titleMedium">Activity history</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Every time you complete, skip, or snooze a reminder (last 90 days).
            </Text>
            {history.length === 0 ? (
              <Text variant="bodyMedium" style={[styles.muted, { marginTop: 12 }]}>
                No history yet. When you act on reminders from the Dashboard, they appear here.
              </Text>
            ) : (
              history.map((event) => (
                <HistoryRow key={event.id} event={event} habits={habits} tasks={tasks} />
              ))
            )}
          </AppCard>
        ) : null}

        {tab === 'weekly' ? (
          <>
            <AppCard featured>
              <Text variant="titleMedium">This week</Text>
              <Text variant="bodyLarge" style={styles.statLine}>
                {weekStats.completed} completed · {weekStats.skipped} skipped · {weekStats.snoozed}{' '}
                snoozed
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {weekStats.total} reminder actions recorded
              </Text>
            </AppCard>
            <AppCard>
              <Text variant="titleMedium">What we noticed</Text>
              {weeklyInsights.map((insight) => (
                <InsightBlock key={insight.id} title={insight.text} evidence={insight.evidence} />
              ))}
            </AppCard>
            <AppCard>
              <Text variant="titleMedium">This week&apos;s actions</Text>
              {weekEvents.length === 0 ? (
                <Text variant="bodySmall" style={styles.muted}>
                  No actions this week yet.
                </Text>
              ) : (
                weekEvents.slice(0, 40).map((event) => (
                  <HistoryRow key={event.id} event={event} habits={habits} tasks={tasks} />
                ))
              )}
            </AppCard>
          </>
        ) : null}

        {tab === 'monthly' ? (
          <>
            <AppCard featured>
              <Text variant="titleMedium">This month</Text>
              <Text variant="bodyLarge" style={styles.statLine}>
                {monthStats.completed} completed · {monthStats.skipped} skipped ·{' '}
                {monthStats.snoozed} snoozed
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                {monthStats.total} reminder actions recorded
              </Text>
            </AppCard>
            <AppCard>
              <Text variant="titleMedium">Trends</Text>
              {monthlyInsights.length ? (
                monthlyInsights.map((insight) => (
                  <InsightBlock key={insight.id} title={insight.text} evidence={insight.evidence} />
                ))
              ) : (
                <Text variant="bodySmall" style={styles.muted}>
                  Keep responding to reminders for a month-over-month trend.
                </Text>
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </ScreenScaffold>
  );
}

function statusColor(status: Task['status'], palette: BrandPalette): string {
  if (status === 'completed') return palette.success;
  if (status === 'skipped') return palette.danger;
  if (status === 'snoozed') return palette.warn;
  return palette.textMuted;
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  const palette = useBrandPalette();
  return (
    <View style={styles.breakdownRow}>
      <Text variant="bodySmall" style={styles.muted}>
        {label}
      </Text>
      <Text variant="labelLarge" style={{ color: palette.accentText }}>
        {value}%
      </Text>
    </View>
  );
}

function HistoryRow({
  event,
  habits,
  tasks,
}: {
  event: BehaviourEvent;
  habits: Habit[];
  tasks: Task[];
}) {
  const palette = useBrandPalette();
  return (
    <View style={[styles.row, { borderTopColor: palette.divider }]}>
      <View style={styles.rowBody}>
        <Text variant="bodyLarge">{eventTitle(event, habits, tasks)}</Text>
        <Text variant="labelSmall" style={styles.muted}>
          {formatWhen(event.actedAt || event.createdAt)}
          {event.delayMinutes > 0 ? ` · ${event.delayMinutes} min late` : ''}
          {event.snoozeMinutes ? ` · snoozed ${event.snoozeMinutes} min` : ''}
        </Text>
      </View>
      <Text variant="labelMedium" style={{ color: actionColor(event.action, palette) }}>
        {actionLabel(event.action)}
      </Text>
    </View>
  );
}

function InsightBlock({ title, evidence }: { title: string; evidence: string[] }) {
  return (
    <View style={styles.insightBlock}>
      <Text variant="bodyLarge">{title}</Text>
      {evidence.map((line) => (
        <Text key={line} variant="bodySmall" style={styles.evidence}>
          • {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  intro: {
    opacity: 0.8,
    marginBottom: 4,
  },
  segments: {
    marginBottom: 4,
  },
  score: {
    fontWeight: '700',
    marginTop: 4,
  },
  muted: {
    opacity: 0.75,
    marginTop: 4,
  },
  breakdown: {
    marginTop: 14,
    gap: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    paddingRight: 10,
  },
  statLine: {
    marginTop: 6,
  },
  insightBlock: {
    marginTop: 12,
  },
  evidence: {
    opacity: 0.75,
    marginLeft: 4,
    marginTop: 2,
  },
});
