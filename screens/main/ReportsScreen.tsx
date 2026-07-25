import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import { AppCard } from '../../components/AppCard';
import { useAuthStore } from '../../features/auth/authStore';
import { useDataStore } from '../../features/data/dataStore';
import { generateWeeklyInsights, generateMonthlyTrendInsights } from '../../AI/insightsEngine';
import { todayDateKey, startOfWeek, startOfMonth } from '../../utils/date';
import { calculateBdi, computeConsistency } from '../../services/bdiService';
import { MILESTONE_DAYS } from '../../constants/categories';
import { generateMilestoneComparison } from '../../AI/insightsEngine';
import { FirestoreRepository } from '../../database/baseRepository';
import { COLLECTIONS } from '../../firebase/config';
import type { WeeklyReport, MonthlyReport, MilestoneReport } from '../../types';

class ReportRepository extends FirestoreRepository {
  weeklyPath(uid: string) {
    return `users/${uid}/${COLLECTIONS.weeklyReports}`;
  }

  monthlyPath(uid: string) {
    return `users/${uid}/${COLLECTIONS.monthlyReports}`;
  }

  milestonePath(uid: string) {
    return `users/${uid}/${COLLECTIONS.milestoneReports}`;
  }

  saveWeekly(uid: string, report: WeeklyReport) {
    return this.set(this.weeklyPath(uid), report.id, report);
  }

  saveMonthly(uid: string, report: MonthlyReport) {
    return this.set(this.monthlyPath(uid), report.id, report);
  }

  saveMilestone(uid: string, report: MilestoneReport) {
    return this.set(this.milestonePath(uid), report.id, report);
  }
}

const reportRepository = new ReportRepository();

export function ReportsScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const behaviourEvents = useDataStore((s) => s.behaviourEvents);
  const tasks = useDataStore((s) => s.tasks);
  const goals = useDataStore((s) => s.goals);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly' | 'milestones'>('daily');

  const dailySummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return {
      date: todayDateKey(),
      tasksCompleted: completed,
      tasksTotal: total,
      bdiScore: profile?.bdiScore ?? 50,
    };
  }, [tasks, profile]);

  const weekEvents = useMemo(() => {
    const start = startOfWeek();
    return behaviourEvents.filter((e) => e.createdAt >= `${start}T00:00:00.000Z`);
  }, [behaviourEvents]);

  const weeklyInsights = useMemo(() => generateWeeklyInsights(weekEvents), [weekEvents]);

  const monthlyInsights = useMemo(() => {
    const month = startOfMonth();
    const current = behaviourEvents.filter((e) => e.createdAt >= `${month}T00:00:00.000Z`);
    const prevMonthDate = new Date(month);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevKey = startOfMonth(prevMonthDate);
    const previous = behaviourEvents.filter(
      (e) => e.createdAt >= `${prevKey}T00:00:00.000Z` && e.createdAt < `${month}T00:00:00.000Z`,
    );
    return generateMonthlyTrendInsights(current, previous);
  }, [behaviourEvents]);

  useEffect(() => {
    if (!user || tab !== 'weekly') return;
    const bdi = calculateBdi({
      events: weekEvents,
      goalCompletionRate:
        goals.filter((g) => g.progress >= g.target).length / Math.max(goals.length, 1),
      dailyImprovement: 0,
      weeklyImprovement: 0,
      weeklyConsistency: computeConsistency(Array(7).fill(weekEvents.length > 0)),
      monthlyConsistency: 0.5,
    });
    const report: WeeklyReport = {
      id: `week_${startOfWeek()}`,
      userId: user.uid,
      weekStart: startOfWeek(),
      weekEnd: todayDateKey(),
      bdiScore: bdi.score,
      bdiChange: bdi.weeklyChange,
      completionRate: weekEvents.filter((e) => e.action.includes('completed')).length /
        Math.max(weekEvents.length, 1),
      skipRate: weekEvents.filter((e) => e.action === 'skipped').length / Math.max(weekEvents.length, 1),
      snoozeRate:
        weekEvents.filter((e) => e.action === 'snoozed' || e.action === 'completed_after_snooze')
          .length / Math.max(weekEvents.length, 1),
      weeklyConsistency: computeConsistency(Array(7).fill(weekEvents.length > 0)),
      insights: weeklyInsights,
      generatedAt: new Date().toISOString(),
    };
    reportRepository.saveWeekly(user.uid, report).catch(() => undefined);
  }, [user, tab, weekEvents, weeklyInsights, goals]);

  const milestoneInsights = useMemo(() => {
    const streakDays = profile?.currentStreakDays ?? 0;
    const milestone = MILESTONE_DAYS.find((d) => streakDays >= d) ?? 30;
    const recent = behaviourEvents.slice(0, 50);
    const prior = behaviourEvents.slice(50, 100);
    return generateMilestoneComparison(recent, prior, milestone);
  }, [behaviourEvents, profile]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        buttons={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'milestones', label: 'Milestones' },
        ]}
      />

      {tab === 'daily' ? (
        <AppCard>
          <Text variant="titleMedium">Daily summary</Text>
          <Text variant="bodyLarge">
            {dailySummary.tasksCompleted}/{dailySummary.tasksTotal} tasks completed
          </Text>
          <Text variant="bodyMedium">BDI {dailySummary.bdiScore}</Text>
          <Text variant="bodySmall" style={styles.note}>
            Simple summary only — no behavioural analysis on daily reports.
          </Text>
        </AppCard>
      ) : null}

      {tab === 'weekly' ? (
        <AppCard>
          <Text variant="titleMedium">Weekly behaviour analysis</Text>
          {weeklyInsights.map((insight) => (
            <ViewBlock key={insight.id} title={insight.text} evidence={insight.evidence} />
          ))}
        </AppCard>
      ) : null}

      {tab === 'monthly' ? (
        <AppCard>
          <Text variant="titleMedium">Monthly trends</Text>
          {monthlyInsights.map((insight) => (
            <ViewBlock key={insight.id} title={insight.text} evidence={insight.evidence} />
          ))}
        </AppCard>
      ) : null}

      {tab === 'milestones' ? (
        <AppCard>
          <Text variant="titleMedium">Milestone comparison</Text>
          <Text variant="bodySmall" style={styles.note}>
            Milestones: {MILESTONE_DAYS.join(', ')} days
          </Text>
          {milestoneInsights.map((insight) => (
            <ViewBlock key={insight.id} title={insight.text} evidence={insight.evidence} />
          ))}
        </AppCard>
      ) : null}
    </ScrollView>
  );
}

function ViewBlock({ title, evidence }: { title: string; evidence: string[] }) {
  return (
    <>
      <Text variant="bodyLarge" style={styles.insight}>
        {title}
      </Text>
      {evidence.map((line) => (
        <Text key={line} variant="bodySmall" style={styles.evidence}>
          • {line}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  note: {
    marginTop: 8,
    opacity: 0.7,
  },
  insight: {
    marginTop: 12,
  },
  evidence: {
    opacity: 0.75,
    marginLeft: 4,
  },
});
