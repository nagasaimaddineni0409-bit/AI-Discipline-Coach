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
  /** Notification arrived before tasks/auth were ready — retry after sync. */
  pendingTaskId: string | null;
  openAlarm: (payload: ActiveAlarm) => void;
  clearAlarm: () => void;
  setPendingTaskId: (taskId: string | null) => void;
}

export const useAlarmStore = create<AlarmState>((set) => ({
  active: null,
  pendingTaskId: null,
  openAlarm: (active) => set({ active, pendingTaskId: null }),
  clearAlarm: () => set({ active: null }),
  setPendingTaskId: (pendingTaskId) => set({ pendingTaskId }),
}));
