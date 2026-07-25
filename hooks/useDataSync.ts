import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useDataStore } from '../features/data/dataStore';
import {
  habitRepository,
  goalRepository,
  taskRepository,
  reminderRepository,
  behaviourEventRepository,
} from '../database/contentRepository';
import { useAuthStore } from '../features/auth/authStore';
import { todayDateKey } from '../utils/date';
import { calculateBdi, computeConsistency } from '../services/bdiService';
import { cacheGet, cacheSet } from '../services/cacheService';
import { ensureDailyTasksForHabits } from '../services/dailyTaskScheduler';
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
      }
    }

    hydrateCache();
    setSyncing(true);

    const unsubHabits = habitRepository.subscribeByUser(uid, async (habits) => {
      setHabits(habits);
      const dateKey = todayDateKey();
      const existing = await taskRepository.listForDate(uid, dateKey);
      await ensureDailyTasksForHabits(uid, habits, existing);
    });
    const unsubGoals = goalRepository.subscribeByUser(uid, (goals) => {
      setGoals(goals);
    });
    const unsubTasks = taskRepository.subscribeToday(uid, dateKey, (tasks) => {
      setTasks(tasks);
    });

    (async () => {
      try {
        const [reminders, events] = await Promise.all([
          reminderRepository.listUpcoming(uid, 1),
          behaviourEventRepository.listRecent(uid, 90),
        ]);
        if (cancelled) return;
        setUpcomingReminder(reminders[0] ?? null);
        setBehaviourEvents(events);

        const weeklyFlags = buildDailyFlags(events, 7);
        const monthlyFlags = buildDailyFlags(events, 30);
        const goalCompletion =
          (await goalRepository.listByUser(uid)).filter((g) => g.progress >= g.target).length /
          Math.max((await goalRepository.listByUser(uid)).length, 1);

        const bdi = calculateBdi({
          events,
          goalCompletionRate: goalCompletion,
          dailyImprovement: computeConsistency(buildDailyFlags(events, 2)) - 0.5,
          weeklyImprovement: computeConsistency(weeklyFlags) - 0.5,
          weeklyConsistency: computeConsistency(weeklyFlags),
          monthlyConsistency: computeConsistency(monthlyFlags),
        });
        setBdi(bdi);

        const habits = await habitRepository.listByUser(uid);
        const goals = await goalRepository.listByUser(uid);
        const tasks = await taskRepository.listForDate(uid, dateKey);
        await cacheSet(`data_${uid}_${dateKey}`, { habits, goals, tasks });
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    const netUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) setSyncing(false);
    });

    return () => {
      cancelled = true;
      unsubHabits();
      unsubGoals();
      unsubTasks();
      netUnsub();
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

function buildDailyFlags(events: { createdAt: string; action: string }[], days: number): boolean[] {
  const flags: boolean[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => e.createdAt.startsWith(key));
    const completed = dayEvents.some(
      (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
    );
    flags.push(completed);
  }
  return flags;
}
