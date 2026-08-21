import type { BehaviourEvent, Habit, HabitCategory, ReportInsight } from '../types';

function categoryLabel(cat: HabitCategory): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function morningEvents(events: BehaviourEvent[]): BehaviourEvent[] {
  return events.filter((e) => {
    const hour = new Date(e.scheduledAt).getHours();
    return hour >= 5 && hour < 12;
  });
}

function weekendEvents(events: BehaviourEvent[]): BehaviourEvent[] {
  return events.filter((e) => {
    const day = new Date(e.scheduledAt).getDay();
    return day === 0 || day === 6;
  });
}

function weekdayEvents(events: BehaviourEvent[]): BehaviourEvent[] {
  return events.filter((e) => {
    const day = new Date(e.scheduledAt).getDay();
    return day >= 1 && day <= 5;
  });
}

function completionRate(events: BehaviourEvent[]): number {
  if (!events.length) return 0;
  const done = events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  ).length;
  return done / events.length;
}

function skipRate(events: BehaviourEvent[]): number {
  if (!events.length) return 0;
  return events.filter((e) => e.action === 'skipped').length / events.length;
}

function snoozeRate(events: BehaviourEvent[]): number {
  if (!events.length) return 0;
  return (
    events.filter((e) => e.action === 'snoozed' || e.action === 'completed_after_snooze').length /
    events.length
  );
}

function completedEvents(events: BehaviourEvent[]): BehaviourEvent[] {
  return events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  );
}

function meanDelay(events: BehaviourEvent[]): number {
  const done = completedEvents(events);
  if (!done.length) return 0;
  return done.reduce((acc, e) => acc + Math.max(0, e.delayMinutes ?? 0), 0) / done.length;
}

function habitTitle(event: BehaviourEvent, habits: Habit[]): string {
  if (event.habitId) {
    const habit = habits.find((h) => h.id === event.habitId);
    if (habit) return habit.title;
  }
  return categoryLabel(event.goalCategory);
}

function buildBehaviourInsights(
  events: BehaviourEvent[],
  habits: Habit[],
  scopeLabel: 'week' | 'month',
): ReportInsight[] {
  const insights: ReportInsight[] = [];
  if (!events.length) {
    return [
      {
        id: 'no-data',
        text: `Not enough behaviour data yet this ${scopeLabel}. Respond to reminders to unlock insights.`,
        evidence: [`0 behaviour events in the selected ${scopeLabel}`],
        sentiment: 'neutral',
      },
    ];
  }

  const overallRate = completionRate(events);
  const skips = skipRate(events);
  const snoozes = snoozeRate(events);
  const delay = meanDelay(events);
  const done = completedEvents(events);
  const lateShare =
    done.length > 0 ? done.filter((e) => (e.delayMinutes ?? 0) > 15).length / done.length : 0;

  // Overall follow-through
  if (overallRate < 0.45) {
    insights.push({
      id: 'low-completion',
      text: `Follow-through is weak this ${scopeLabel} — fewer than half of alarms were completed.`,
      evidence: [
        `${Math.round(overallRate * 100)}% completion across ${events.length} actions`,
        `${Math.round(skips * 100)}% skipped · ${Math.round(snoozes * 100)}% snooze-related`,
      ],
      sentiment: 'negative',
    });
  } else if (overallRate < 0.65) {
    insights.push({
      id: 'soft-completion',
      text: `Discipline is mixed this ${scopeLabel}. Completion sits in the middle — room to tighten skips and delays.`,
      evidence: [
        `${Math.round(overallRate * 100)}% completion across ${events.length} actions`,
        `${Math.round(skips * 100)}% skipped`,
      ],
      sentiment: 'neutral',
    });
  } else if (overallRate >= 0.85) {
    insights.push({
      id: 'strong-completion',
      text: `Strong follow-through this ${scopeLabel}.`,
      evidence: [`${Math.round(overallRate * 100)}% completion across ${events.length} actions`],
      sentiment: 'positive',
    });
  }

  if (skips >= 0.25) {
    insights.push({
      id: 'high-skip',
      text: `Skipping is a dominant pattern this ${scopeLabel}.`,
      evidence: [
        `${Math.round(skips * 100)}% of actions were skips (${events.filter((e) => e.action === 'skipped').length} of ${events.length})`,
      ],
      sentiment: 'negative',
    });
  }

  if (snoozes >= 0.3) {
    insights.push({
      id: 'high-snooze',
      text: `Deferral (snooze) is frequent this ${scopeLabel}.`,
      evidence: [`${Math.round(snoozes * 100)}% of actions involved snoozing`],
      sentiment: 'negative',
    });
  }

  if (done.length >= 2 && (delay > 30 || lateShare >= 0.4)) {
    insights.push({
      id: 'late-completions',
      text: 'Completions often arrive late — the alarm is met, but latency is high.',
      evidence: [
        `Average delay ${Math.round(delay)} minutes on completed items`,
        `${Math.round(lateShare * 100)}% of completions were more than 15 minutes late`,
      ],
      sentiment: 'negative',
    });
  }

  // Per-habit strengths / weaknesses (need ≥2 samples)
  const byHabit = new Map<string, BehaviourEvent[]>();
  for (const e of events) {
    const key = e.habitId ?? `cat:${e.goalCategory}`;
    const list = byHabit.get(key) ?? [];
    list.push(e);
    byHabit.set(key, list);
  }

  type HabitStat = { title: string; rate: number; n: number; category: HabitCategory };
  const stats: HabitStat[] = [];
  for (const [, list] of byHabit) {
    if (list.length < 2) continue;
    stats.push({
      title: habitTitle(list[0]!, habits),
      rate: completionRate(list),
      n: list.length,
      category: list[0]!.goalCategory,
    });
  }
  stats.sort((a, b) => b.rate - a.rate);

  const strong = stats.filter((s) => s.n >= 2 && s.rate >= 0.75).slice(0, 2);
  const weak = stats.filter((s) => s.n >= 2 && s.rate <= 0.45).slice(0, 2);

  for (const s of strong) {
    insights.push({
      id: `strong-${s.title}`,
      text: `You are stronger on “${s.title}”.`,
      category: s.category,
      evidence: [`${Math.round(s.rate * 100)}% completion across ${s.n} actions`],
      sentiment: 'positive',
    });
  }
  for (const s of weak) {
    insights.push({
      id: `weak-${s.title}`,
      text: `“${s.title}” needs attention — follow-through is low.`,
      category: s.category,
      evidence: [`${Math.round(s.rate * 100)}% completion across ${s.n} actions`],
      sentiment: 'negative',
    });
  }

  // Category-level (when habit titles not enough)
  const byCategory = new Map<HabitCategory, BehaviourEvent[]>();
  for (const e of events) {
    const list = byCategory.get(e.goalCategory) ?? [];
    list.push(e);
    byCategory.set(e.goalCategory, list);
  }
  for (const [cat, catEvents] of byCategory) {
    if (catEvents.length < 3) continue;
    const rate = completionRate(catEvents);
    if (rate >= overallRate + 0.15 && rate >= 0.7) {
      insights.push({
        id: `cat-strong-${cat}`,
        text: `${categoryLabel(cat)} is a relative strength this ${scopeLabel}.`,
        category: cat,
        evidence: [
          `${Math.round(rate * 100)}% completion vs ${Math.round(overallRate * 100)}% overall`,
        ],
        sentiment: 'positive',
      });
    } else if (rate + 0.15 <= overallRate && rate <= 0.55) {
      insights.push({
        id: `cat-weak-${cat}`,
        text: `${categoryLabel(cat)} is lagging behind your other areas.`,
        category: cat,
        evidence: [
          `${Math.round(rate * 100)}% completion vs ${Math.round(overallRate * 100)}% overall`,
        ],
        sentiment: 'negative',
      });
    }
  }

  const morning = morningEvents(events);
  const morningRate = completionRate(morning);
  if (morning.length >= 3 && morningRate >= overallRate + 0.1) {
    insights.push({
      id: 'morning-discipline',
      text: 'Morning discipline is stronger than the rest of the day.',
      evidence: [
        `${Math.round(morningRate * 100)}% morning completion (${morning.length} actions)`,
        `${Math.round(overallRate * 100)}% overall`,
      ],
      sentiment: 'positive',
    });
  }

  const weekend = weekendEvents(events);
  const weekday = weekdayEvents(events);
  if (weekend.length >= 2 && weekday.length >= 3) {
    const weekendRate = completionRate(weekend);
    const weekdayRate = completionRate(weekday);
    if (weekendRate + 0.15 <= weekdayRate) {
      insights.push({
        id: 'weekend-dip',
        text: 'Weekend discipline dips compared with weekdays.',
        evidence: [
          `${Math.round(weekendRate * 100)}% weekend · ${Math.round(weekdayRate * 100)}% weekday`,
        ],
        sentiment: 'negative',
      });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const unique = insights.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  if (!unique.length) {
    unique.push({
      id: 'steady',
      text: `Behaviour is relatively steady this ${scopeLabel} — no sharp strength or failure pattern stood out.`,
      evidence: [
        `${events.length} recorded interactions`,
        `${Math.round(overallRate * 100)}% completion · ${Math.round(skips * 100)}% skipped`,
      ],
      sentiment: 'neutral',
    });
  }

  return unique.slice(0, 8);
}

/** Rule-based weekly insights grounded in stored behaviour events. */
export function generateWeeklyInsights(
  events: BehaviourEvent[],
  habits: Habit[] = [],
): ReportInsight[] {
  return buildBehaviourInsights(events, habits, 'week');
}

export function generateMonthlyTrendInsights(
  currentMonth: BehaviourEvent[],
  previousMonth: BehaviourEvent[],
  habits: Habit[] = [],
): ReportInsight[] {
  const insights: ReportInsight[] = [];
  const currentRate = completionRate(currentMonth);
  const previousRate = completionRate(previousMonth);

  if (currentMonth.length && previousMonth.length) {
    const delta = currentRate - previousRate;
    if (delta >= 0.05) {
      insights.push({
        id: 'monthly-improving',
        text: 'Month-over-month completion is improving.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'positive',
      });
    } else if (delta <= -0.05) {
      insights.push({
        id: 'monthly-declining',
        text: 'Month-over-month completion declined.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'negative',
      });
    } else {
      insights.push({
        id: 'monthly-stable',
        text: 'Month-over-month completion is roughly stable.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'neutral',
      });
    }
  }

  // Always include within-month behavioural reading (not only MoM).
  const within = buildBehaviourInsights(currentMonth, habits, 'month').filter(
    (i) => i.id !== 'no-data' || !currentMonth.length,
  );
  for (const insight of within) {
    if (!insights.some((x) => x.id === insight.id)) insights.push(insight);
  }

  if (!insights.length && !currentMonth.length) {
    insights.push({
      id: 'monthly-empty',
      text: 'No reminder actions recorded this month yet.',
      evidence: ['0 behaviour events'],
      sentiment: 'neutral',
    });
  }

  return insights.slice(0, 8);
}

export function generateMilestoneComparison(
  milestoneEvents: BehaviourEvent[],
  priorEvents: BehaviourEvent[],
  milestoneDays: number,
): ReportInsight[] {
  const recentRate = completionRate(milestoneEvents);
  const priorRate = completionRate(priorEvents);
  const comparison =
    recentRate >= priorRate
      ? `At ${milestoneDays} days, your recent completion rate (${Math.round(recentRate * 100)}%) meets or exceeds earlier behaviour (${Math.round(priorRate * 100)}%).`
      : `At ${milestoneDays} days, recent completion (${Math.round(recentRate * 100)}%) is below your earlier baseline (${Math.round(priorRate * 100)}%)—a useful focus area.`;

  return [
    {
      id: `milestone-${milestoneDays}`,
      text: comparison,
      evidence: [
        `${milestoneEvents.length} events in milestone window`,
        `${priorEvents.length} events in comparison window`,
      ],
      sentiment: recentRate >= priorRate ? 'positive' : 'neutral',
    },
  ];
}
