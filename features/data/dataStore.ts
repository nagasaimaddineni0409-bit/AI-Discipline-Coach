import { create } from 'zustand';
import type { Habit, Goal, Task, Reminder, BehaviourEvent, BdiSnapshot } from '../../types';

interface DataState {
  habits: Habit[];
  goals: Goal[];
  tasks: Task[];
  upcomingReminder: Reminder | null;
  behaviourEvents: BehaviourEvent[];
  bdi: BdiSnapshot | null;
  syncing: boolean;
  setHabits: (habits: Habit[]) => void;
  setGoals: (goals: Goal[]) => void;
  setTasks: (tasks: Task[]) => void;
  setUpcomingReminder: (reminder: Reminder | null) => void;
  setBehaviourEvents: (events: BehaviourEvent[]) => void;
  setBdi: (bdi: BdiSnapshot | null) => void;
  setSyncing: (syncing: boolean) => void;
}

export const useDataStore = create<DataState>((set) => ({
  habits: [],
  goals: [],
  tasks: [],
  upcomingReminder: null,
  behaviourEvents: [],
  bdi: null,
  syncing: false,
  setHabits: (habits) => set({ habits }),
  setGoals: (goals) => set({ goals }),
  setTasks: (tasks) => set({ tasks }),
  setUpcomingReminder: (upcomingReminder) => set({ upcomingReminder }),
  setBehaviourEvents: (behaviourEvents) => set({ behaviourEvents }),
  setBdi: (bdi) => set({ bdi }),
  setSyncing: (syncing) => set({ syncing }),
}));
