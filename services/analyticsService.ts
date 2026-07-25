import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from '../database/baseRepository';
import type { AnalyticsEvent } from '../types';
import { generateId } from '../utils/date';

class AnalyticsRepository extends FirestoreRepository {
  track(event: Omit<AnalyticsEvent, 'id'>) {
    const id = generateId();
    return this.set(COLLECTIONS.analytics, id, { ...event, id });
  }
}

export const analyticsRepository = new AnalyticsRepository();

export function trackScreenView(userId: string, screen: string) {
  return analyticsRepository.track({
    userId,
    name: 'screen_view',
    properties: { screen },
    createdAt: new Date().toISOString(),
  });
}
