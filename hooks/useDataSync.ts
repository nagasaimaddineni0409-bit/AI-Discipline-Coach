import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../features/data/dataStore';
import {
  habitRepository,
  goalRepository,
  taskRepository,
  behaviourEventRepository,
} from '../database/contentRepository';
import { useAuthStore } from '../features/auth/authStore';
import { todayDateKey } from '../utils/date';
import {
  calculateBdi,
  computeConsistency,
  buildDailyCompletionFlags,
} from '../services/bdiService';
import { cacheGet, cacheSet } from '../services/cacheService';
import { ensureDailyTasksForHabits } from '../services/dailyTaskScheduler';
import { reconcileTasksWithHabits } from '../services/habitLifecycle';
import { refreshUpcomingReminder } from '../services/reminderActions';
import { ensureAllPendingAlarmsScheduled } from '../services/alarmScheduler';
import { flushAlarmsAfterDataReady } from '../services/alarmService';
import type { Habit, Goal, Task } from '../types';

export function useDataSync() {
  const user = useAuthStore((s) => s.user);
  const {
    setHabits,
    setGoals,
    setTasks,
    setUpcomingReminder,
    setBehaviourEvents,
    setBdi,
    setSyncing,
  } = useDataStore();

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    const dateKey = todayDateKey();
    let cancelled = false;

    async function hydrateCache() {
      const cached = await cacheGet<{
        habits: Habit[];
        goals: Goal[];
        tasks: Task[];
      }>(`data_${uid}_${dateKey}`);
      if (cached && !cancelled) {
        setHabits(cached.habits);
        setGoals(cached.goals);
        setTasks(cached.tasks);
        await flushAlarmsAfterDataReady(uid);
      }
    }

    async function rescheduleAlarms() {
      try {
        await ensureAllPendingAlarmsScheduled(uid);
      } catch {
        // Best-effort — scheduling failures surface via permission tips.
      }
    }

    hydrateCache();
    setSyncing(true);

    const unsubHabits = habitRepository.subscribeByUser(uid, async (habits) => {
      setHabits(habits);
      const today = todayDateKey();
      const existing = await taskRepository.listForDate(uid, today);
      // Drop tasks for deleted / paused / archived habits so Dashboard stays in sync.
      await reconcileTasksWithHabits(uid, habits, existing);
      const remaining = await taskRepository.listForDate(uid, today);
      await ensureDailyTasksForHabits(uid, habits, remaining);
      if (!cancelled) {
        await refreshUpcomingReminder(uid);
        await rescheduleAlarms();
        await flushAlarmsAfterDataReady(uid);
      }
    });
    const unsubGoals = goalRepository.subscribeByUser(uid, (goals) => {
      setGoals(goals);
    });
    const unsubTasks = taskRepository.subscribeToday(uid, dateKey, async (tasks) => {
      setTasks(tasks);
      if (!cancelled) {
        await refreshUpcomingReminder(uid);
        await flushAlarmsAfterDataReady(uid);
      }
    });

    (async () => {
      try {
        const events = await behaviourEventRepository.listRecent(uid, 90);
        if (cancelled) return;
        setBehaviourEvents(events);
        await refreshUpcomingReminder(uid);
        await rescheduleAlarms();
        await flushAlarmsAfterDataReady(uid);

        const weeklyFlags = buildDailyCompletionFlags(events, 7);
        const monthlyFlags = buildDailyCompletionFlags(events, 30);
        const goals = await goalRepository.listByUser(uid);
        const goalCompletion =
          goals.filter((g) => g.progress >= g.target).length / Math.max(goals.length, 1);

        const bdi = calculateBdi({
          events,
          goalCompletionRate: goalCompletion,
          weeklyConsistency: computeConsistency(weeklyFlags),
          monthlyConsistency: computeConsistency(monthlyFlags),
        });
        setBdi(bdi);

        const habits = await habitRepository.listByUser(uid);
        const tasks = await taskRepository.listForDate(uid, dateKey);
        await cacheSet(`data_${uid}_${dateKey}`, { habits, goals, tasks });
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    const netUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) setSyncing(false);
    });

    // Re-verify OS schedules when returning from background (OEMs may have dropped them).
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active' && !cancelled) {
        void rescheduleAlarms();
        void flushAlarmsAfterDataReady(uid);
      }
    };
    const appStateSub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      unsubHabits();
      unsubGoals();
      unsubTasks();
      netUnsub();
      appStateSub.remove();
    };
  }, [
    user,
    setHabits,
    setGoals,
    setTasks,
    setUpcomingReminder,
    setBehaviourEvents,
    setBdi,
    setSyncing,
  ]);
}
