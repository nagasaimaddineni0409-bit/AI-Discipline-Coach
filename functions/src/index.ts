import * as admin from 'firebase-admin';
import * as functionsV1 from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

admin.initializeApp();
const db = admin.firestore();

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

interface BehaviourEventDoc {
  action: string;
  goalCategory: string;
  scheduledAt: string;
  createdAt: string;
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

export const scheduledWeeklyReports = onSchedule('every monday 06:00', async () => {
  const usersSnap = await db.collection('users').limit(500).get();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const eventsSnap = await db
      .collection(`users/${uid}/behaviour_events`)
      .where('createdAt', '>=', weekStart.toISOString())
      .get();
    const events = eventsSnap.docs.map((d) => d.data() as BehaviourEventDoc);
    const insights = buildWeeklyInsights(events);
    await db.collection(`users/${uid}/weekly_reports`).doc(`week_${weekStart.toISOString().slice(0, 10)}`).set({
      userId: uid,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: new Date().toISOString().slice(0, 10),
      completionRate: completionRate(events),
      skipRate: events.filter((e) => e.action === 'skipped').length / Math.max(events.length, 1),
      snoozeRate: snoozeRate(events),
      insights,
      generatedAt: new Date().toISOString(),
    });
  }
  logger.info('Weekly reports generated', { users: usersSnap.size });
});

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
