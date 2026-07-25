import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from './baseRepository';
import type { UserProfile, PremiumFlags } from '../types';
import { PREMIUM_FEATURE_DEFAULTS } from '../constants/featureFlags';

export class UserRepository extends FirestoreRepository {
  private path(uid: string) {
    return `${COLLECTIONS.users}/${uid}`;
  }

  async ensureProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
    const ref = this.docRef(COLLECTIONS.users, uid);
    const existing = await this.get<UserProfile>(COLLECTIONS.users, uid);
    const now = new Date().toISOString();
    if (existing) return existing;

    const profile: UserProfile = {
      uid,
      email,
      displayName: displayName || email.split('@')[0] || 'User',
      createdAt: now,
      updatedAt: now,
      onboardingCompleted: false,
      isAdmin: false,
      premiumEnabled: false,
      bdiScore: 50,
      bdiWeeklyDelta: 0,
      bdiMonthlyDelta: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
    };
    await this.set(COLLECTIONS.users, uid, profile);

    const premium: PremiumFlags = {
      userId: uid,
      ...PREMIUM_FEATURE_DEFAULTS,
    };
    await this.set(`${COLLECTIONS.premium}`, uid, premium);

    return profile;
  }

  async getProfile(uid: string): Promise<UserProfile | null> {
    return this.get<UserProfile>(COLLECTIONS.users, uid);
  }

  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    await this.update(COLLECTIONS.users, uid, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateBdi(uid: string, score: number, weeklyDelta: number, monthlyDelta: number) {
    await this.updateProfile(uid, {
      bdiScore: score,
      bdiWeeklyDelta: weeklyDelta,
      bdiMonthlyDelta: monthlyDelta,
    });
  }
}

export const userRepository = new UserRepository();
