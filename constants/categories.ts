import type { HabitCategory } from '../types';

export const HABIT_CATEGORIES: {
  id: HabitCategory;
  label: string;
  icon: string;
  color: string;
}[] = [
  { id: 'health', label: 'Health', icon: 'heart-pulse', color: '#E53935' },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', color: '#FB8C00' },
  { id: 'work', label: 'Work', icon: 'briefcase', color: '#1E88E5' },
  { id: 'learning', label: 'Learning', icon: 'book-open-variant', color: '#8E24AA' },
  { id: 'finance', label: 'Finance', icon: 'currency-usd', color: '#43A047' },
  { id: 'relationships', label: 'Relationships', icon: 'account-heart', color: '#D81B60' },
  { id: 'mindfulness', label: 'Mindfulness', icon: 'meditation', color: '#00ACC1' },
  { id: 'personal', label: 'Personal', icon: 'star', color: '#6D4C41' },
  { id: 'custom', label: 'Custom', icon: 'shape', color: '#546E7A' },
];

export const SNOOZE_OPTIONS: { label: string; minutes: 5 | 10 | 15 | 30 | 60 }[] = [
  { label: '5 Minutes', minutes: 5 },
  { label: '10 Minutes', minutes: 10 },
  { label: '15 Minutes', minutes: 15 },
  { label: '30 Minutes', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
];

export const MILESTONE_DAYS = [30, 50, 100, 175, 200, 365] as const;

export const REMINDER_TONES = [
  { id: 'default', label: 'Default' },
  { id: 'gentle', label: 'Gentle' },
  { id: 'focus', label: 'Focus' },
  { id: 'urgent', label: 'Urgent' },
];

export const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
] as const;
