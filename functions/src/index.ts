import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { sendReportEmail } from './mailer';
import {
  buildWeeklyClinicalReport,
  renderWeeklyEmailHtml,
  renderWeeklyEmailText,
  type BehaviourEventDoc,
} from './weeklyAnalysis';

admin.initializeApp();
const db = admin.firestore();

/** Bound onto email-sending functions so Secret Manager injects process.env.RESEND_API_KEY. */
const resendApiKey = defineSecret('RESEND_API_KEY');
/** Optional; defaults to Resend test sender until disciplineai.com is verified. */
const mailFrom = defineString(
  'MAIL_FROM',
  { default: 'Discipline AI Clinical Review <beth.t@example.com>' },
);

/**
 * Purge every trace of a user when their auth account is deleted.
 *
 * `recursiveDelete` clears users/{uid} and all of its subcollections
 * (habits, goals, tasks, reminders, behaviour_events, *_reports, notifications).
 * The settings and premium docs are keyed by uid at the top level, so they
 * are removed separately.
 */
export const purgeUserData = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;
  try {
    await db.recursiveDelete(db.collection('users').doc(uid));
    await Promise.all([
      db.collection('settings').doc(uid).delete(),
      db.collection('premium').doc(uid).delete(),
    ]);
    logger.info('Purged data for deleted user', { uid });
  } catch (err) {
    logger.error('Failed to purge user data', { uid, err });
    throw err;
  }
});

function weekWindow(now = new Date()): { weekStart: Date; weekEnd: Date } {
  const weekEnd = new Date(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  return { weekStart, weekEnd };
}

async function loadWeekEvents(uid: string, weekStart: Date): Promise<BehaviourEventDoc[]> {
  const eventsSnap = await db
    .collection(`users/${uid}/behaviour_events`)
    .where('createdAt', '>=', weekStart.toISOString())
    .get();
  return eventsSnap.docs.map((d) => d.data() as BehaviourEventDoc);
}

async function resolveRecipient(
  uid: string,
): Promise<{ email: string; displayName: string; bdiScore?: number } | null> {
  const userDoc = await db.collection('users').doc(uid).get();
  const profile = userDoc.data() as
    | { email?: string; displayName?: string; bdiScore?: number }
    | undefined;
  let email = profile?.email?.trim() ?? '';
  let displayName = profile?.displayName?.trim() ?? '';
  if (!email) {
    try {
      const authUser = await admin.auth().getUser(uid);
      email = authUser.email?.trim() ?? '';
      if (!displayName) displayName = authUser.displayName?.trim() ?? '';
    } catch {
      // Auth record missing.
    }
  }
  if (!email) return null;
  return { email, displayName: displayName || email.split('@')[0] || 'there', bdiScore: profile?.bdiScore };
}

async function generateAndEmailWeeklyReport(
  uid: string,
  opts: { sendEmail: boolean },
): Promise<{ emailed: boolean; subject: string; to?: string }> {
  const { weekStart, weekEnd } = weekWindow();
  const events = await loadWeekEvents(uid, weekStart);
  const recipient = await resolveRecipient(uid);
  const report = buildWeeklyClinicalReport({
    events,
    displayName: recipient?.displayName ?? 'there',
    email: recipient?.email ?? '',
    bdiScore: recipient?.bdiScore,
    weekStart,
    weekEnd,
  });

  const reportRef = db
    .collection(`users/${uid}/weekly_reports`)
    .doc(`week_${report.weekStart}`);

  await reportRef.set({
    userId: uid,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    bdiScore: report.bdiScore,
    completionRate: report.stats.completionRate,
    skipRate: report.stats.skipRate,
    snoozeRate: report.stats.snoozeRate,
    onTimeRate: report.stats.onTimeRate,
    avgDelayMinutes: report.stats.avgDelayMinutes,
    qualityScore: report.stats.qualityScore,
    insights: report.insights,
    formulation: report.formulation,
    focus: report.focus,
    generatedAt: new Date().toISOString(),
  });

  if (!opts.sendEmail) {
    return { emailed: false, subject: report.subject };
  }
  if (!recipient?.email) {
    logger.warn('No email on file for weekly report', { uid });
    return { emailed: false, subject: report.subject };
  }

  const emailed = await sendReportEmail({
    to: recipient.email,
    subject: report.subject,
    html: renderWeeklyEmailHtml(report),
    text: renderWeeklyEmailText(report),
  });

  await reportRef.set(
    {
      emailSentAt: emailed ? new Date().toISOString() : null,
      emailTo: recipient.email,
      emailError: emailed ? null : 'delivery_failed_or_unconfigured',
    },
    { merge: true },
  );

  return { emailed, subject: report.subject, to: recipient.email };
}

function completionRate(events: BehaviourEventDoc[]): number {
  if (!events.length) return 0;
  const done = events.filter(
    (e) => e.action === 'completed' || e.action === 'completed_after_snooze',
  ).length;
  return done / events.length;
}

function snoozeRate(events: BehaviourEventDoc[]): number {
  if (!events.length) return 0;
  return (
    events.filter((e) => e.action === 'snoozed' || e.action === 'completed_after_snooze').length /
    events.length
  );
}

function buildWeeklyInsights(events: BehaviourEventDoc[]): { text: string; evidence: string[] }[] {
  const insights: { text: string; evidence: string[] }[] = [];
  const overall = completionRate(events);
  const health = events.filter((e) => e.goalCategory === 'health');
  if (health.length >= 3 && snoozeRate(health) >= 0.35) {
    insights.push({
      text: 'You frequently snooze health reminders.',
      evidence: [`${Math.round(snoozeRate(health) * 100)}% snooze-related health actions`],
    });
  }
  const work = events.filter((e) => e.goalCategory === 'work');
  if (work.length >= 4 && completionRate(work) >= 0.85) {
    insights.push({
      text: 'Work consistency is excellent.',
      evidence: [`${Math.round(completionRate(work) * 100)}% work completion`],
    });
  }
  if (!insights.length) {
    insights.push({
      text: 'Weekly behaviour is steady.',
      evidence: [`${events.length} events`, `${Math.round(overall * 100)}% completion`],
    });
  }
  return insights;
}

export const scheduledWeeklyReports = onSchedule(
  {
    schedule: '0 7 * * 1',
    timeZone: 'Asia/Kolkata',
    timeoutSeconds: 540,
    memory: '512MiB',
    secrets: [resendApiKey],
  },
  async () => {
    // Ensure MAIL_FROM param is available to the mailer via process.env.
    process.env.MAIL_FROM = mailFrom.value();
    const usersSnap = await db.collection('users').limit(500).get();
    let emailed = 0;
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const settings = await db.collection('settings').doc(uid).get();
      const weeklyEmailEnabled = settings.data()?.weeklyEmailEnabled !== false;
      try {
        const result = await generateAndEmailWeeklyReport(uid, { sendEmail: weeklyEmailEnabled });
        if (result.emailed) emailed += 1;
      } catch (err) {
        logger.error('Weekly report failed for user', { uid, err });
      }
    }
    logger.info('Weekly reports generated', { users: usersSnap.size, emailed });
  },
);

/** Lets a signed-in user email themselves the current week's clinical review. */
export const requestWeeklyReportEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    process.env.MAIL_FROM = mailFrom.value();
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
    const uid = request.auth.uid;
    const settings = await db.collection('settings').doc(uid).get();
    if (settings.data()?.weeklyEmailEnabled === false) {
      throw new HttpsError('failed-precondition', 'Weekly email reviews are turned off in Settings.');
    }
    const result = await generateAndEmailWeeklyReport(uid, { sendEmail: true });
    if (!result.to) {
      throw new HttpsError('failed-precondition', 'No email address is on file for this account.');
    }
    if (!result.emailed) {
      throw new HttpsError(
        'unavailable',
        'The review was saved but email delivery is not configured yet. Ask the project owner to set RESEND_API_KEY or SMTP credentials on Cloud Functions.',
      );
    }
    return { sent: true, to: result.to, subject: result.subject };
  },
);

export const onPushQueueCreated = onDocumentCreated(
  'admin_feature_flags_push_queue/{docId}',
  async (event) => {
    const data = event.data?.data() as { title?: string; body?: string } | undefined;
    if (!data?.title) return;
    const settingsSnap = await db.collection('settings').where('pushToken', '!=', null).limit(200).get();
    const messages = settingsSnap.docs
      .map((d) => d.data().pushToken as string)
      .filter(Boolean)
      .map((to) => ({ to, title: data.title, body: data.body ?? '' }));
    logger.info('Push broadcast queued', { count: messages.length });
  },
);

export const adminGetAnalytics = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
  const user = await db.collection('users').doc(request.auth.uid).get();
  if (!user.exists || user.data()?.isAdmin !== true) {
    throw new HttpsError('permission-denied', 'Admin only');
  }
  const usersCount = (await db.collection('users').count().get()).data().count;
  const eventsAggregate = await db.collectionGroup('behaviour_events').count().get();
  return {
    usersCount,
    behaviourEvents: eventsAggregate.data().count,
  };
});

export const generateBehaviourInsights = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Auth required');
  const uid = request.auth.uid;
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const eventsSnap = await db
    .collection(`users/${uid}/behaviour_events`)
    .where('createdAt', '>=', since.toISOString())
    .get();
  const events = eventsSnap.docs.map((d) => d.data() as BehaviourEventDoc);
  return { insights: buildWeeklyInsights(events) };
});
