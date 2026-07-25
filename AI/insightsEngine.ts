import type { BehaviourEvent, HabitCategory, ReportInsight } from '../types';

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

function snoozeRate(events: BehaviourEvent[]): number {
  if (!events.length) return 0;
  return events.filter((e) => e.action === 'snoozed' || e.action === 'completed_after_snooze')
    .length / events.length;
}

/** Rule-based insights grounded in stored behaviour events only (V1, non-conversational). */
export function generateWeeklyInsights(events: BehaviourEvent[]): ReportInsight[] {
  const insights: ReportInsight[] = [];
  if (!events.length) {
    return [
      {
        id: 'no-data',
        text: 'Not enough behaviour data yet. Complete or respond to reminders to unlock insights.',
        evidence: ['0 behaviour events in the selected week'],
        sentiment: 'neutral',
      },
    ];
  }

  const morning = morningEvents(events);
  const morningRate = completionRate(morning);
  const overallRate = completionRate(events);
  if (morning.length >= 3 && morningRate >= overallRate + 0.1) {
    insights.push({
      id: 'morning-discipline',
      text: 'Morning discipline improved compared with your overall week.',
      category: undefined,
      evidence: [
        `${Math.round(morningRate * 100)}% completion on ${morning.length} morning-scheduled actions`,
        `${Math.round(overallRate * 100)}% overall weekly completion`,
      ],
      sentiment: 'positive',
    });
  }

  const byCategory = new Map<HabitCategory, BehaviourEvent[]>();
  for (const e of events) {
    const list = byCategory.get(e.goalCategory) ?? [];
    list.push(e);
    byCategory.set(e.goalCategory, list);
  }

  for (const [cat, catEvents] of byCategory) {
    const snooze = snoozeRate(catEvents);
    if (catEvents.length >= 3 && snooze >= 0.35) {
      insights.push({
        id: `snooze-${cat}`,
        text: `You frequently snooze ${categoryLabel(cat).toLowerCase()} reminders.`,
        category: cat,
        evidence: [
          `${Math.round(snooze * 100)}% snooze-related actions across ${catEvents.length} ${cat} events`,
        ],
        sentiment: 'negative',
      });
    }
    const rate = completionRate(catEvents);
    if (catEvents.length >= 4 && rate >= 0.85) {
      insights.push({
        id: `excellent-${cat}`,
        text: `${categoryLabel(cat)} consistency is excellent.`,
        category: cat,
        evidence: [`${Math.round(rate * 100)}% completion across ${catEvents.length} events`],
        sentiment: 'positive',
      });
    }
  }

  const weekend = weekendEvents(events);
  const weekday = weekdayEvents(events);
  const weekendRate = completionRate(weekend);
  const weekdayRate = completionRate(weekday);
  if (weekend.length >= 2 && weekday.length >= 3 && weekendRate + 0.15 <= weekdayRate) {
    insights.push({
      id: 'weekend-dip',
      text: 'Weekend discipline decreases compared with weekdays.',
      evidence: [
        `${Math.round(weekendRate * 100)}% weekend completion (${weekend.length} events)`,
        `${Math.round(weekdayRate * 100)}% weekday completion (${weekday.length} events)`,
      ],
      sentiment: 'negative',
    });
  }

  if (!insights.length) {
    insights.push({
      id: 'steady',
      text: 'Your behaviour patterns this week are steady. Keep responding to reminders consistently.',
      evidence: [`${events.length} recorded interactions`, `${Math.round(overallRate * 100)}% completion`],
      sentiment: 'neutral',
    });
  }

  return insights;
}

export function generateMonthlyTrendInsights(
  currentMonth: BehaviourEvent[],
  previousMonth: BehaviourEvent[],
): ReportInsight[] {
  const insights: ReportInsight[] = [];
  const currentRate = completionRate(currentMonth);
  const previousRate = completionRate(previousMonth);

  if (currentMonth.length && previousMonth.length) {
    const delta = currentRate - previousRate;
    if (delta >= 0.05) {
      insights.push({
        id: 'monthly-improving',
        text: 'Long-term completion trend is improving month over month.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'positive',
      });
    } else if (delta <= -0.05) {
      insights.push({
        id: 'monthly-declining',
        text: 'Completion trend declined compared with the previous month.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'negative',
      });
    } else {
      insights.push({
        id: 'monthly-stable',
        text: 'Your monthly behaviour trend is stable.',
        evidence: [
          `${Math.round(currentRate * 100)}% this month vs ${Math.round(previousRate * 100)}% last month`,
        ],
        sentiment: 'neutral',
      });
    }
  }

  const snooze = snoozeRate(currentMonth);
  if (currentMonth.length >= 10 && snooze >= 0.3) {
    insights.push({
      id: 'monthly-snooze',
      text: 'Snoozing remains a recurring pattern this month.',
      evidence: [`${Math.round(snooze * 100)}% snooze-related actions across ${currentMonth.length} events`],
      sentiment: 'negative',
    });
  }

  return insights;
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
