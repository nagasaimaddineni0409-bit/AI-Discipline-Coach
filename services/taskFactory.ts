import type {
  Habit,
  Goal,
  Task,
  Reminder,
  HabitCategory,
  Priority,
  RepeatRule,
  ScheduleFrequency,
} from '../types';
import { generateId, todayDateKey, localDateTimeIso } from '../utils/date';

export interface ScheduleInput {
  frequency: ScheduleFrequency;
  interval: number;
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
}

function buildRepeatRule(input: ScheduleInput): RepeatRule {
  const rule: RepeatRule = {
    frequency: input.frequency,
    interval: Math.max(1, input.interval || 1),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
  };
  if (input.frequency === 'weekly') {
    rule.daysOfWeek = input.daysOfWeek.length
      ? input.daysOfWeek
      : [new Date(input.startDate).getDay()];
  }
  if (input.frequency === 'monthly') {
    const [, , d] = input.startDate.split('-').map(Number);
    rule.dayOfMonth = d ?? 1;
  }
  return rule;
}

/** One task per habit per calendar day — stable id prevents create/sync races from duplicating. */
export function taskIdForHabitDay(habitId: string, dateKey: string): string {
  return `${habitId}_${dateKey}`;
}

/** One primary alarm reminder per task — same id so reschedules overwrite instead of stacking. */
export function reminderIdForTask(taskId: string): string {
  return `${taskId}_reminder`;
}

export function createTaskFromHabit(habit: Habit, dateKey = todayDateKey()): Task {
  const now = new Date().toISOString();
  return {
    id: taskIdForHabitDay(habit.id, dateKey),
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

export function createReminderFromTask(
  task: Task,
  toneId: string,
  extras?: { customToneUri?: string | null; customToneName?: string | null },
): Reminder {
  const scheduledAt = localDateTimeIso(task.scheduledDate, task.scheduledTime);
  const now = new Date().toISOString();
  return {
    id: reminderIdForTask(task.id),
    userId: task.userId,
    taskId: task.id,
    title: task.title,
    description: task.description,
    scheduledAt,
    toneId,
    customToneUri: extras?.customToneUri ?? null,
    customToneName: extras?.customToneName ?? null,
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
    customToneUri?: string | null;
    customToneName?: string | null;
    color: string;
    icon: string;
    schedule: ScheduleInput;
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
      customToneUri: input.customToneUri ?? null,
      customToneName: input.customToneName ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    repeatRule: buildRepeatRule(input.schedule),
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
    customToneUri?: string | null;
    customToneName?: string | null;
    color: string;
    icon: string;
    target: number;
    dueDate?: string | null;
    notes?: string;
    schedule: ScheduleInput;
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
      customToneUri: input.customToneUri ?? null,
      customToneName: input.customToneName ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    repeatRule: buildRepeatRule(input.schedule),
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
