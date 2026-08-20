export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type GoalKind = 'recurring' | 'one_time';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type HabitCategory =
  | 'health'
  | 'fitness'
  | 'work'
  | 'learning'
  | 'finance'
  | 'relationships'
  | 'mindfulness'
  | 'personal'
  | 'custom';

export type BehaviourAction =
  | 'completed'
  | 'skipped'
  | 'snoozed'
  | 'completed_after_snooze';

export type SnoozeDurationMinutes = 5 | 10 | 15 | 30 | 60;

export type ThemeMode = 'system' | 'light' | 'dark';
export type LanguageCode = 'en';

export type ScheduleFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RepeatRule {
  frequency: ScheduleFrequency;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  startDate?: string;
  endDate?: string | null;
}

export interface ReminderConfig {
  enabled: boolean;
  time: string;
  toneId: string;
  timezone: string;
  /** Local file URI for a user-picked alarm sound (played by the in-app alarm UI). */
  customToneUri?: string | null;
  customToneName?: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  premiumEnabled: boolean;
  bdiScore: number;
  bdiWeeklyDelta: number;
  bdiMonthlyDelta: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: HabitCategory;
  customCategoryLabel?: string;
  priority: Priority;
  notes?: string;
  reminder: ReminderConfig;
  repeatRule: RepeatRule;
  color: string;
  icon: string;
  status: GoalStatus;
  streak: number;
  longestStreak: number;
  completionRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: HabitCategory;
  customCategoryLabel?: string;
  period: GoalPeriod;
  kind: GoalKind;
  priority: Priority;
  reminder: ReminderConfig;
  repeatRule: RepeatRule;
  progress: number;
  target: number;
  color: string;
  icon: string;
  status: GoalStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string | null;
}

export interface Task {
  id: string;
  userId: string;
  habitId?: string;
  goalId?: string;
  title: string;
  description: string;
  category: HabitCategory;
  scheduledDate: string;
  scheduledTime: string;
  priority: Priority;
  status: 'pending' | 'completed' | 'skipped' | 'snoozed';
  snoozedUntil?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId: string;
  title: string;
  description: string;
  scheduledAt: string;
  toneId: string;
  customToneUri?: string | null;
  customToneName?: string | null;
  /** Expo notification id scheduled on this device. */
  notificationId?: string | null;
  status: 'scheduled' | 'delivered' | 'acted';
  createdAt: string;
  updatedAt: string;
}

export interface BehaviourEvent {
  id: string;
  userId: string;
  taskId?: string;
  habitId?: string;
  goalId?: string;
  reminderId?: string;
  action: BehaviourAction;
  scheduledAt: string;
  actedAt: string;
  delayMinutes: number;
  snoozeMinutes?: number;
  goalType?: GoalPeriod;
  goalCategory: HabitCategory;
  streakAtEvent: number;
  streakBroken: boolean;
  completionPercent: number;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface ReportInsight {
  id: string;
  text: string;
  category?: HabitCategory;
  evidence: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface WeeklyReport {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  bdiScore: number;
  bdiChange: number;
  completionRate: number;
  skipRate: number;
  snoozeRate: number;
  weeklyConsistency: number;
  insights: ReportInsight[];
  generatedAt: string;
}

export interface MonthlyReport {
  id: string;
  userId: string;
  month: string;
  bdiScore: number;
  bdiChange: number;
  completionRate: number;
  skipRate: number;
  snoozeRate: number;
  monthlyConsistency: number;
  trend: 'improving' | 'stable' | 'declining';
  insights: ReportInsight[];
  generatedAt: string;
}

export type MilestoneDay = 30 | 50 | 100 | 175 | 200 | 365;

export interface MilestoneReport {
  id: string;
  userId: string;
  milestoneDays: MilestoneDay;
  reachedAt: string;
  bdiAtMilestone: number;
  completionRate: number;
  comparisonSummary: string;
  insights: ReportInsight[];
  generatedAt: string;
}

export interface DailySummary {
  date: string;
  tasksCompleted: number;
  tasksTotal: number;
  bdiScore: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'reminder' | 'report' | 'milestone' | 'system';
  read: boolean;
  data?: Record<string, string>;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  theme: ThemeMode;
  language: LanguageCode;
  notificationsEnabled: boolean;
  reminderSoundsEnabled: boolean;
  defaultReminderToneId: string;
  /** Monday clinical review emailed to the registered address. Default true. */
  weeklyEmailEnabled?: boolean;
  pushToken?: string | null;
  updatedAt: string;
}

export interface PremiumFlags {
  userId: string;
  subscriptionActive: boolean;
  features: {
    advancedAi: boolean;
    exportPdf: boolean;
    wearables: boolean;
  };
}

export interface AnalyticsEvent {
  id: string;
  userId: string;
  name: string;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface FeatureFlags {
  aiInsights: boolean;
  adminPanel: boolean;
  premiumBilling: boolean;
  crashReporting: boolean;
}

export interface BdiSnapshot {
  score: number;
  weeklyChange: number;
  monthlyChange: number;
  components: {
    taskCompletion: number;
    skipRate: number;
    snoozeRate: number;
    consistency: number;
    lateCompletion: number;
    goalCompletion: number;
    dailyImprovement: number;
    weeklyImprovement: number;
  };
  calculatedAt: string;
}
