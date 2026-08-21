import { useEffect, useRef } from 'react';
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
  computeCurrentStreakDays,
} from '../services/bdiService';
import { cacheGet, cacheSet } from '../services/cacheService';
import { ensureDailyTasksForHabits } from '../services/dailyTaskScheduler';
import {
  expireHabitsPastSchedule,
  reconcileTasksWithHabits,
} from '../services/habitLifecycle';
import { refreshUpcomingReminder } from '../services/reminderActions';
import { ensureAllPendingAlarmsScheduled } from '../services/alarmScheduler';
import { flushAlarmsAfterDataReady } from '../services/alarmService';
import { userRepository } from '../database/userRepository';
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
  const subscribedDateRef = useRef(todayDateKey());

  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    let cancelled = false;
    let unsubTasks: (() => void) | null = null;

    async function hydrateCache(dateKey: string) {
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

    function bindTodayTasks(dateKey: string) {
      unsubTasks?.();
      subscribedDateRef.current = dateKey;
      unsubTasks = taskRepository.subscribeToday(uid, dateKey, async (tasks) => {
        setTasks(tasks);
        if (!cancelled) {
          await refreshUpcomingReminder(uid);
          await flushAlarmsAfterDataReady(uid);
        }
      });
    }

    /** Create/reschedule today's + lookahead alarms; archive ended habits. */
    async function syncHabitAlarms(habitsIn: Habit[]) {
      const today = todayDateKey();
      if (today !== subscribedDateRef.current) {
        bindTodayTasks(today);
      }
      const habits = await expireHabitsPastSchedule(uid, habitsIn);
      const existing = await taskRepository.listForDate(uid, today);
      await reconcileTasksWithHabits(uid, habits, existing);
      const remaining = await taskRepository.listForDate(uid, today);
      await ensureDailyTasksForHabits(uid, habits, remaining);
      if (!cancelled) {
        await refreshUpcomingReminder(uid);
        await rescheduleAlarms();
        await flushAlarmsAfterDataReady(uid);
      }
    }

    const dateKey = todayDateKey();
    hydrateCache(dateKey);
    setSyncing(true);
    bindTodayTasks(dateKey);

    const unsubHabits = habitRepository.subscribeByUser(uid, async (habits) => {
      setHabits(habits);
      await syncHabitAlarms(habits);
    });
    const unsubGoals = goalRepository.subscribeByUser(uid, (goals) => {
      setGoals(goals);
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
        const streakFlags = buildDailyCompletionFlags(events, 90);
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

        const currentStreakDays = computeCurrentStreakDays(streakFlags);
        const existingProfile = useAuthStore.getState().profile;
        const longestStreakDays = Math.max(
          existingProfile?.longestStreakDays ?? 0,
          currentStreakDays,
        );
        await userRepository.updateBdi(uid, bdi.score, bdi.weeklyChange, bdi.monthlyChange, {
          currentStreakDays,
          longestStreakDays,
        });
        if (existingProfile?.uid === uid) {
          useAuthStore.getState().setProfile({
            ...existingProfile,
            bdiScore: bdi.score,
            bdiWeeklyDelta: bdi.weeklyChange,
            bdiMonthlyDelta: bdi.monthlyChange,
            currentStreakDays,
            longestStreakDays,
          });
        }

        const habits = await habitRepository.listByUser(uid);
        await syncHabitAlarms(habits);
        const tasks = await taskRepository.listForDate(uid, todayDateKey());
        await cacheSet(`data_${uid}_${todayDateKey()}`, { habits, goals, tasks });
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    const netUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) setSyncing(false);
    });

    // On foreground: rebuild today's + lookahead schedules (covers midnight rollover).
    const onAppState = (next: AppStateStatus) => {
      if (next !== 'active' || cancelled) return;
      void (async () => {
        const habits = useDataStore.getState().habits;
        if (habits.length) await syncHabitAlarms(habits);
        else {
          await rescheduleAlarms();
          await flushAlarmsAfterDataReady(uid);
        }
      })();
    };
    const appStateSub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      unsubHabits();
      unsubGoals();
      unsubTasks?.();
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
