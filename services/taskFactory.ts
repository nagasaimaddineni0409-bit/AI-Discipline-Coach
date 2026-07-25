import type { Habit, Goal, Task, Reminder, HabitCategory, Priority } from '../types';
import { generateId, todayDateKey } from '../utils/date';

export function createTaskFromHabit(habit: Habit, dateKey = todayDateKey()): Task {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    userId: habit.userId,
    habitId: habit.id,
    title: habit.title,
    description: habit.description,
    category: habit.category,
    scheduledDate: dateKey,
    scheduledTime: habit.reminder.time,
    priority: habit.priority,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export function createReminderFromTask(task: Task, toneId: string): Reminder {
  const scheduledAt = `${task.scheduledDate}T${task.scheduledTime}:00.000Z`;
  const now = new Date().toISOString();
  return {
    id: generateId(),
    userId: task.userId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    scheduledAt,
    toneId,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildHabitPayload(
  userId: string,
  input: {
    title: string;
    description: string;
    category: HabitCategory;
    customCategoryLabel?: string;
    priority: Priority;
    notes?: string;
    reminderTime: string;
    reminderEnabled: boolean;
    toneId: string;
    color: string;
    icon: string;
  },
  existing?: Habit,
): Habit {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? generateId(),
    userId,
    title: input.title,
    description: input.description,
    category: input.category,
    customCategoryLabel: input.customCategoryLabel,
    priority: input.priority,
    notes: input.notes,
    reminder: {
      enabled: input.reminderEnabled,
      time: input.reminderTime,
      toneId: input.toneId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    repeatRule: existing?.repeatRule ?? {
      frequency: 'daily',
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
    },
    color: input.color,
    icon: input.icon,
    status: existing?.status ?? 'active',
    streak: existing?.streak ?? 0,
    longestStreak: existing?.longestStreak ?? 0,
    completionRate: existing?.completionRate ?? 0,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function buildGoalPayload(
  userId: string,
  input: {
    title: string;
    description: string;
    category: HabitCategory;
    customCategoryLabel?: string;
    period: Goal['period'];
    kind: Goal['kind'];
    priority: Priority;
    reminderTime: string;
    reminderEnabled: boolean;
    toneId: string;
    color: string;
    icon: string;
    target: number;
    dueDate?: string | null;
    notes?: string;
  },
  existing?: Goal,
): Goal {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? generateId(),
    userId,
    title: input.title,
    description: input.description,
    category: input.category,
    customCategoryLabel: input.customCategoryLabel,
    period: input.period,
    kind: input.kind,
    priority: input.priority,
    reminder: {
      enabled: input.reminderEnabled,
      time: input.reminderTime,
      toneId: input.toneId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    repeatRule: existing?.repeatRule ?? {
      frequency: input.period,
      interval: 1,
    },
    progress: existing?.progress ?? 0,
    target: input.target,
    color: input.color,
    icon: input.icon,
    status: existing?.status ?? 'active',
    notes: input.notes,
    dueDate: input.dueDate ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
