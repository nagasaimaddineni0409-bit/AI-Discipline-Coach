export interface BehaviourEventDoc {
  action: string;
  goalCategory?: string;
  scheduledAt?: string;
  createdAt?: string;
  delayMinutes?: number;
}

export interface WeekInsight {
  id: string;
  title: string;
  body: string;
  valence: 'strength' | 'concern' | 'neutral';
}

export interface WeeklyClinicalReport {
  weekStart: string;
  weekEnd: string;
  displayName: string;
  greetingName: string;
  bdiScore: number | null;
  stats: {
    total: number;
    completed: number;
    skipped: number;
    snoozed: number;
    completedAfterSnooze: number;
    onTime: number;
    late: number;
    completionRate: number;
    skipRate: number;
    snoozeRate: number;
    onTimeRate: number;
    avgDelayMinutes: number;
    qualityScore: number;
  };
  insights: WeekInsight[];
  formulation: string[];
  focus: string;
  subject: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function eventQuality(e: BehaviourEventDoc): number {
  const delay = typeof e.delayMinutes === 'number' ? e.delayMinutes : 0;
  switch (e.action) {
    case 'completed':
      if (delay <= 15) return 1;
      if (delay <= 60) return 0.75;
      return 0.55;
    case 'completed_after_snooze':
      return delay <= 60 ? 0.6 : 0.45;
    case 'snoozed':
      return 0.2;
    case 'skipped':
      return 0;
    default:
      return 0;
  }
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function hourOf(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getHours();
}

function dayOf(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getDay();
}

function formatRange(weekStart: Date, weekEnd: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${weekStart.toLocaleDateString('en-GB', opts)} – ${weekEnd.toLocaleDateString('en-GB', opts)}`;
}

function firstName(displayName: string, email: string): string {
  const fromName = displayName.trim().split(/\s+/)[0];
  if (fromName && !fromName.includes('@')) return fromName;
  const local = email.split('@')[0] ?? 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function buildWeeklyClinicalReport(input: {
  events: BehaviourEventDoc[];
  displayName: string;
  email: string;
  bdiScore?: number;
  weekStart: Date;
  weekEnd: Date;
}): WeeklyClinicalReport {
  const { events, email, weekStart, weekEnd } = input;
  const greetingName = firstName(input.displayName, email);
  const range = formatRange(weekStart, weekEnd);

  const total = events.length;
  const completed = events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  );
  const skipped = events.filter((e) => e.action === 'skipped');
  const snoozed = events.filter((e) => e.action === 'snoozed');
  const afterSnooze = events.filter((e) => e.action === 'completed_after_snooze');
  const onTime = completed.filter((e) => (e.delayMinutes ?? 0) <= 15);
  const late = completed.filter((e) => (e.delayMinutes ?? 0) > 15);
  const delays = completed.map((e) => Math.max(0, e.delayMinutes ?? 0));
  const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
  const quality = total ? (events.reduce((acc, e) => acc + eventQuality(e), 0) / total) * 100 : 0;

  const morning = events.filter((e) => {
    const h = hourOf(e.scheduledAt);
    return h !== null && h >= 5 && h < 12;
  });
  const weekday = events.filter((e) => {
    const d = dayOf(e.scheduledAt);
    return d !== null && d >= 1 && d <= 5;
  });
  const weekend = events.filter((e) => {
    const d = dayOf(e.scheduledAt);
    return d === 0 || d === 6;
  });
  const rate = (list: BehaviourEventDoc[]) =>
    list.length
      ? list.filter((e) => e.action === 'completed' || e.action === 'completed_after_snooze').length /
        list.length
      : 0;

  const byCategory = new Map<string, BehaviourEventDoc[]>();
  for (const e of events) {
    const cat = e.goalCategory || 'personal';
    const list = byCategory.get(cat) ?? [];
    list.push(e);
    byCategory.set(cat, list);
  }

  const insights: WeekInsight[] = [];
  if (!total) {
    insights.push({
      id: 'no-data',
      title: 'Insufficient observational data',
      body: 'There were no recorded reminder responses this week. Without behavioural samples, I cannot yet formulate a reliable pattern. The work begins when you meet the alarm — even imperfectly.',
      valence: 'neutral',
    });
  } else {
    const morningRate = rate(morning);
    const overallRate = rate(events);
    if (morning.length >= 3 && morningRate >= overallRate + 0.1) {
      insights.push({
        id: 'morning',
        title: 'Stronger self-regulation in the morning',
        body: `Morning commitments were completed at ${pct(morningRate)}, versus ${pct(overallRate)} across the full week. This is a classic diurnal pattern: regulatory capacity is often highest earlier in the day. Protect those morning anchors.`,
        valence: 'strength',
      });
    }

    for (const [cat, list] of byCategory) {
      const snoozeShare =
        list.filter((e) => e.action === 'snoozed' || e.action === 'completed_after_snooze').length /
        list.length;
      if (list.length >= 3 && snoozeShare >= 0.35) {
        insights.push({
          id: `snooze-${cat}`,
          title: `Deferral clustering in ${cat}`,
          body: `${pct(snoozeShare)} of your ${cat} responses involved snoozing. Repeated delay is not laziness; it is typically avoidance of a friction point (time, context, or emotional load). Name the friction, then shrink the first step.`,
          valence: 'concern',
        });
      }
      const catRate = rate(list);
      if (list.length >= 4 && catRate >= 0.85) {
        insights.push({
          id: `strength-${cat}`,
          title: `High follow-through in ${cat}`,
          body: `${pct(catRate)} completion across ${list.length} ${cat} prompts. This domain is a reliable identity cue — use it as a scaffold when other areas slip.`,
          valence: 'strength',
        });
      }
    }

    const weekendRate = rate(weekend);
    const weekdayRate = rate(weekday);
    if (weekend.length >= 2 && weekday.length >= 3 && weekendRate + 0.15 <= weekdayRate) {
      insights.push({
        id: 'weekend-dip',
        title: 'Weekend structure is thinner than weekdays',
        body: `Weekend follow-through was ${pct(weekendRate)} against ${pct(weekdayRate)} on weekdays. Many people outsource discipline to the weekday timetable. Weekends need an external scaffold — fewer alarms, kept more strictly.`,
        valence: 'concern',
      });
    }

    if (onTime.length / Math.max(completed.length, 1) >= 0.7 && completed.length >= 3) {
      insights.push({
        id: 'latency',
        title: 'Prompt responding',
        body: `${pct(onTime.length / completed.length)} of completions occurred within 15 minutes of the scheduled time. Short latency is one of the cleanest markers of intact intention–action coupling.`,
        valence: 'strength',
      });
    } else if (completed.length >= 3 && avgDelay > 30) {
      insights.push({
        id: 'latency-late',
        title: 'Elevated response latency',
        body: `Average delay on completed items was ${Math.round(avgDelay)} minutes. The commitment is still being honoured, but the gap between cue and action is where competing impulses win. Tighten the window rather than adding more habits.`,
        valence: 'concern',
      });
    }

    if (!insights.length) {
      insights.push({
        id: 'steady',
        title: 'A steady, unremarkable week — in the best sense',
        body: `${total} recorded responses with ${pct(overallRate)} follow-through. There is no dramatic spike or collapse. Consistency of this kind is how discipline becomes identity rather than a performance.`,
        valence: 'neutral',
      });
    }
  }

  const formulation: string[] = [];
  if (!total) {
    formulation.push(
      `Dear ${greetingName}, I have no behavioural samples for ${range}. A review without data would be speculation. When you answer even a single alarm this coming week, we will have a starting formulation.`,
    );
  } else {
    formulation.push(
      `I have reviewed your recorded responses for ${range}. This is a behavioural reading of how you met, deferred, or declined the commitments you set — not a verdict on character.`,
    );
    formulation.push(
      `Across ${total} alarm interactions, follow-through was ${pct(completed.length / total)} (including items completed after a snooze). Avoidance (skips) accounted for ${pct(skipped.length / total)}; deferral (snooze) for ${pct(snoozed.length / total)}. Mean latency on completed items was ${Math.round(avgDelay)} minute${Math.round(avgDelay) === 1 ? '' : 's'}.`,
    );
    if (input.bdiScore != null) {
      formulation.push(
        `Your overall Behavioural Discipline Index currently stands at ${Math.round(input.bdiScore)}. That index weights the quality of each alarm response (including delay), day-to-day consistency, and longer-term goal follow-through. Treat movement in the index as feedback, not as a moral score.`,
      );
    }
  }

  let focus: string;
  if (!total) {
    focus =
      'Keep every scheduled alarm you already have. Respond once — complete, skip, or snooze — so we have a clean sample next week.';
  } else if (snoozed.length / total >= 0.3) {
    focus =
      'For the coming week, allow at most one snooze per task. A second snooze is usually the moment intention dissolves. If the task is not possible, skip it honestly rather than negotiating with the clock.';
  } else if (skipped.length / total >= 0.25) {
    focus =
      'Skips are information: the plan may be oversized. Reduce one habit’s scope (shorter duration, earlier time) instead of abandoning the identity. Complete a smaller version within 15 minutes of the alarm.';
  } else if (weekend.length >= 2 && rate(weekend) + 0.15 <= rate(weekday)) {
    focus =
      'Hold two weekend alarms at weekday standard: same time, no extra snooze. The aim is continuity of self, not a packed Saturday.';
  } else if (avgDelay > 20 && completed.length) {
    focus =
      'Protect the first 15 minutes after each alarm. Put the first physical step within arm’s reach the night before so latency has fewer places to hide.';
  } else {
    focus =
      'Do not add new habits this week. Repeat the current schedule with the same response quality. Stability is the intervention.';
  }

  const stats = {
    total,
    completed: completed.length,
    skipped: skipped.length,
    snoozed: snoozed.length,
    completedAfterSnooze: afterSnooze.length,
    onTime: onTime.length,
    late: late.length,
    completionRate: total ? completed.length / total : 0,
    skipRate: total ? skipped.length / total : 0,
    snoozeRate: total ? snoozed.length / total : 0,
    onTimeRate: completed.length ? onTime.length / completed.length : 0,
    avgDelayMinutes: Math.round(avgDelay),
    qualityScore: Math.round(clamp(quality, 0, 100)),
  };

  return {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    displayName: input.displayName,
    greetingName,
    bdiScore: input.bdiScore ?? null,
    stats,
    insights,
    formulation,
    focus,
    subject: `Your weekly behavioural review — ${range}`,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderWeeklyEmailHtml(report: WeeklyClinicalReport): string {
  const insightBlocks = report.insights
    .map((i) => {
      const tint = i.valence === 'strength' ? '#0F766E' : i.valence === 'concern' ? '#9A3412' : '#3F3F46';
      return `<tr><td style="padding:0 0 16px 0;">
        <p style="margin:0 0 4px 0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${tint};font-family:Georgia, 'Times New Roman', serif;">${escapeHtml(i.title)}</p>
        <p style="margin:0;font-size:16px;line-height:1.65;color:#1C1917;font-family:Georgia, 'Times New Roman', serif;">${escapeHtml(i.body)}</p>
      </td></tr>`;
    })
    .join('');

  const formulation = report.formulation
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:#1C1917;font-family:Georgia, 'Times New Roman', serif;">${escapeHtml(p)}</p>`,
    )
    .join('');

  const bdiCell =
    report.bdiScore == null
      ? '—'
      : String(Math.round(report.bdiScore));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<title>${escapeHtml(report.subject)}</title></head>
<body style="margin:0;padding:0;background:#EFEBE6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEBE6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#F7F4EF;border:1px solid #D6D0C7;">
        <tr><td style="padding:28px 36px 20px 36px;border-bottom:2px solid #0F766E;">
          <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#0F766E;font-family:Georgia, serif;">Discipline AI · Behavioural Review</p>
          <h1 style="margin:0;font-size:26px;line-height:1.3;color:#1C1917;font-weight:normal;font-family:Georgia, 'Times New Roman', serif;">Weekly clinical note</h1>
          <p style="margin:8px 0 0 0;font-size:14px;color:#57534E;font-family:Georgia, serif;">${escapeHtml(report.weekStart)} to ${escapeHtml(report.weekEnd)} · Confidential to ${escapeHtml(report.greetingName)}</p>
        </td></tr>
        <tr><td style="padding:28px 36px 8px 36px;">${formulation}</td></tr>
        <tr><td style="padding:8px 36px 24px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E7E0D6;">
            <tr>
              <td style="padding:16px;width:25%;border-right:1px solid #E7E0D6;" align="center">
                <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#78716C;font-family:Georgia, serif;">BDI</p>
                <p style="margin:6px 0 0 0;font-size:22px;color:#0F766E;font-family:Georgia, serif;">${escapeHtml(bdiCell)}</p>
              </td>
              <td style="padding:16px;width:25%;border-right:1px solid #E7E0D6;" align="center">
                <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#78716C;font-family:Georgia, serif;">Follow-through</p>
                <p style="margin:6px 0 0 0;font-size:22px;color:#1C1917;font-family:Georgia, serif;">${pct(report.stats.completionRate)}</p>
              </td>
              <td style="padding:16px;width:25%;border-right:1px solid #E7E0D6;" align="center">
                <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#78716C;font-family:Georgia, serif;">On-time</p>
                <p style="margin:6px 0 0 0;font-size:22px;color:#1C1917;font-family:Georgia, serif;">${pct(report.stats.onTimeRate)}</p>
              </td>
              <td style="padding:16px;width:25%;" align="center">
                <p style="margin:0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#78716C;font-family:Georgia, serif;">Mean delay</p>
                <p style="margin:6px 0 0 0;font-size:22px;color:#1C1917;font-family:Georgia, serif;">${report.stats.avgDelayMinutes}m</p>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 0 0;font-size:13px;color:#78716C;font-family:Georgia, serif;">
            Completions ${report.stats.completed} · Skips ${report.stats.skipped} · Snoozes ${report.stats.snoozed} · Response quality ${report.stats.qualityScore}/100
          </p>
        </td></tr>
        <tr><td style="padding:0 36px 8px 36px;">
          <p style="margin:0 0 12px 0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0F766E;font-family:Georgia, serif;">Clinical observations</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${insightBlocks}</table>
        </td></tr>
        <tr><td style="padding:8px 36px 28px 36px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F766E;">
            <tr><td style="padding:20px 22px;">
              <p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#CCFBF1;font-family:Georgia, serif;">Recommended focus — coming week</p>
              <p style="margin:0;font-size:16px;line-height:1.65;color:#F7F4EF;font-family:Georgia, 'Times New Roman', serif;">${escapeHtml(report.focus)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 36px 32px 36px;">
          <p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#1C1917;font-family:Georgia, serif;">With respect for the work you are doing,</p>
          <p style="margin:16px 0 0 0;font-size:17px;color:#1C1917;font-family:Georgia, serif;">Avery Lang, MSc</p>
          <p style="margin:2px 0 0 0;font-size:13px;color:#57534E;font-family:Georgia, serif;">Senior Behaviour Analyst<br/>Discipline AI Clinical Review</p>
        </td></tr>
        <tr><td style="padding:16px 36px 24px 36px;border-top:1px solid #D6D0C7;">
          <p style="margin:0;font-size:11px;line-height:1.55;color:#A8A29E;font-family:Georgia, serif;">
            This letter is generated from your reminder actions in Discipline AI. It is behavioural coaching based on your own logged responses — not a medical, psychiatric, or diagnostic opinion. You can turn off weekly reviews in Settings.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function renderWeeklyEmailText(report: WeeklyClinicalReport): string {
  const observations = report.insights.map((i) => `${i.title}\n${i.body}`).join('\n\n');
  return [
    'DISCIPLINE AI — WEEKLY BEHAVIOURAL REVIEW',
    `${report.weekStart} to ${report.weekEnd}`,
    '',
    ...report.formulation,
    '',
    `BDI: ${report.bdiScore ?? '—'}`,
    `Follow-through: ${pct(report.stats.completionRate)}`,
    `On-time among completions: ${pct(report.stats.onTimeRate)}`,
    `Mean delay: ${report.stats.avgDelayMinutes} minutes`,
    `Completions ${report.stats.completed} · Skips ${report.stats.skipped} · Snoozes ${report.stats.snoozed}`,
    `Response quality: ${report.stats.qualityScore}/100`,
    '',
    'CLINICAL OBSERVATIONS',
    observations,
    '',
    'RECOMMENDED FOCUS FOR THE COMING WEEK',
    report.focus,
    '',
    'With respect for the work you are doing,',
    'Avery Lang, MSc',
    'Senior Behaviour Analyst',
    'Discipline AI Clinical Review',
    '',
    'This letter is behavioural coaching from your logged reminder actions, not a medical diagnosis. Turn off weekly reviews in Settings at any time.',
  ].join('\n');
}
