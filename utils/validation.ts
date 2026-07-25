import { z } from 'zod';

export const emailSchema = z.string().email('Enter a valid email');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const habitFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(500).optional().default(''),
  category: z.string(),
  customCategoryLabel: z.string().max(50).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  notes: z.string().max(1000).optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  reminderEnabled: z.boolean(),
  toneId: z.string(),
  color: z.string(),
  icon: z.string(),
});

export const goalFormSchema = habitFormSchema.extend({
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  kind: z.enum(['recurring', 'one_time']),
  target: z.number().min(1).max(10000),
  dueDate: z.string().optional().nullable(),
});

export type HabitFormValues = z.infer<typeof habitFormSchema>;
export type GoalFormValues = z.infer<typeof goalFormSchema>;
