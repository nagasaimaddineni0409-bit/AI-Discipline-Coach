import { z } from 'zod';
import { todayDateKey } from './date';

export const emailSchema = z.string().email('Enter a valid email');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date');

const scheduleFields = {
  frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(52),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable().optional(),
};

const entityBaseShape = {
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(500).optional().default(''),
  category: z.string(),
  customCategoryLabel: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  notes: z.string().max(1000).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/, 'Select a valid reminder time'),
  reminderEnabled: z.boolean(),
  toneId: z.string(),
  color: z.string(),
  icon: z.string(),
  ...scheduleFields,
};

interface ScheduleShape {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
}

function weeklyHasDays(v: ScheduleShape): boolean {
  return v.frequency !== 'weekly' || v.daysOfWeek.length > 0;
}

function endAfterStart(v: ScheduleShape): boolean {
  return !v.endDate || v.endDate >= v.startDate;
}

/** Past dates are blocked unless the form is editing and the start date was left unchanged. */
function startNotInPast(v: ScheduleShape, originalStartDate?: string | null): boolean {
  const today = todayDateKey();
  if (v.startDate >= today) return true;
  return Boolean(originalStartDate && v.startDate === originalStartDate);
}

const habitBaseSchema = z.object(entityBaseShape);
const goalBaseSchema = z.object({
  ...entityBaseShape,
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  kind: z.enum(['recurring', 'one_time']),
  target: z.number().min(1).max(10000),
  dueDate: z.string().optional().nullable(),
});

function withScheduleRules<T extends ScheduleShape>(
  schema: z.ZodType<T>,
  originalStartDate?: string | null,
) {
  return schema
    .refine((v) => weeklyHasDays(v), {
      message: 'Select at least one day of the week',
      path: ['daysOfWeek'],
    })
    .refine((v) => endAfterStart(v), {
      message: 'End date must be after the start date',
      path: ['endDate'],
    })
    .refine((v) => startNotInPast(v, originalStartDate), {
      message: 'Start date cannot be in the past',
      path: ['startDate'],
    });
}

export const habitFormSchema = withScheduleRules(habitBaseSchema);

export const goalFormSchema = withScheduleRules(goalBaseSchema);

export function habitFormSchemaFor(originalStartDate?: string | null) {
  return withScheduleRules(habitBaseSchema, originalStartDate);
}

export function goalFormSchemaFor(originalStartDate?: string | null) {
  return withScheduleRules(goalBaseSchema, originalStartDate);
}

export type HabitFormValues = z.infer<typeof habitBaseSchema>;
export type GoalFormValues = z.infer<typeof goalBaseSchema>;
