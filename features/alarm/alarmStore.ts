import { create } from 'zustand';
import type { Reminder, Task } from '../../types';

export interface ActiveAlarm {
  task: Task;
  reminder: Reminder;
  /** Why the alarm opened — helps debug missed fires. */
  source: 'notification' | 'tap' | 'overdue' | 'manual';
}

interface AlarmState {
  active: ActiveAlarm | null;
  openAlarm: (payload: ActiveAlarm) => void;
  clearAlarm: () => void;
}

export const useAlarmStore = create<AlarmState>((set) => ({
  active: null,
  openAlarm: (active) => set({ active }),
  clearAlarm: () => set({ active: null }),
}));
