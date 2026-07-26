import type { EntityFormValues } from '../components/EntityForm';
import type { Goal, Habit, RepeatRule } from '../types';
import { todayDateKey } from './date';

/** Turn a stored repeat rule back into the schedule fields the form edits. */
function scheduleValuesFrom(rule: RepeatRule): Pick<
  EntityFormValues,
  'frequency' | 'interval' | 'daysOfWeek' | 'startDate' | 'endDate'
> {
  return {
    frequency: rule.frequency,
    interval: Math.max(1, rule.interval || 1),
    daysOfWeek: rule.daysOfWeek ?? [],
    startDate: rule.startDate ?? todayDateKey(),
    endDate: rule.endDate ?? null,
  };
}

export function habitToFormValues(habit: Habit): EntityFormValues {
  return {
    title: habit.title,
    description: habit.description ?? '',
    category: habit.category,
    customCategoryLabel: habit.customCategoryLabel ?? '',
    priority: habit.priority,
    notes: habit.notes ?? '',
    reminderTime: habit.reminder.time,
    reminderEnabled: habit.reminder.enabled,
    toneId: habit.reminder.toneId,
    customToneUri: habit.reminder.customToneUri ?? null,
    customToneName: habit.reminder.customToneName ?? null,
    color: habit.color,
    icon: habit.icon,
    ...scheduleValuesFrom(habit.repeatRule),
  };
}

export function goalToFormValues(
  goal: Goal,
): EntityFormValues & { period: Goal['period']; kind: Goal['kind']; target: string } {
  return {
    title: goal.title,
    description: goal.description ?? '',
    category: goal.category,
    customCategoryLabel: goal.customCategoryLabel ?? '',
    priority: goal.priority,
    notes: goal.notes ?? '',
    reminderTime: goal.reminder.time,
    reminderEnabled: goal.reminder.enabled,
    toneId: goal.reminder.toneId,
    customToneUri: goal.reminder.customToneUri ?? null,
    customToneName: goal.reminder.customToneName ?? null,
    color: goal.color,
    icon: goal.icon,
    period: goal.period,
    kind: goal.kind,
    target: String(goal.target),
    ...scheduleValuesFrom(goal.repeatRule),
  };
}
