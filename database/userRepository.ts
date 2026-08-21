import { COLLECTIONS } from '../firebase/config';
import { FirestoreRepository } from './baseRepository';
import type { UserProfile, PremiumFlags } from '../types';
import { PREMIUM_FEATURE_DEFAULTS } from '../constants/featureFlags';

export class UserRepository extends FirestoreRepository {
  private path(uid: string) {
    return `${COLLECTIONS.users}/${uid}`;
  }

  async ensureProfile(uid: string, email: string, displayName: string): Promise<UserProfile> {
    const existing = await this.get<UserProfile>(COLLECTIONS.users, uid);
    const now = new Date().toISOString();
    const emailLocal = email.split('@')[0] || 'User';
    const nextName = displayName.trim();

    if (existing) {
      // Registration can race with onAuthStateChanged: the profile may be created
      // first with the email prefix. Upgrade it once we have a real display name.
      const isPlaceholder =
        !existing.displayName ||
        existing.displayName === emailLocal ||
        existing.displayName === 'User';
      if (nextName && nextName !== existing.displayName && isPlaceholder) {
        await this.updateProfile(uid, { displayName: nextName });
        return { ...existing, displayName: nextName, updatedAt: now };
      }
      return existing;
    }

    const profile: UserProfile = {
      uid,
      email,
      displayName: nextName || emailLocal,
      createdAt: now,
      updatedAt: now,
      onboardingCompleted: false,
      isAdmin: false,
      premiumEnabled: false,
      bdiScore: 0,
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

  async updateBdi(
    uid: string,
    score: number,
    weeklyDelta: number,
    monthlyDelta: number,
    streaks?: { currentStreakDays: number; longestStreakDays: number },
  ) {
    await this.updateProfile(uid, {
      bdiScore: score,
      bdiWeeklyDelta: weeklyDelta,
      bdiMonthlyDelta: monthlyDelta,
      ...(streaks
        ? {
            currentStreakDays: streaks.currentStreakDays,
            longestStreakDays: streaks.longestStreakDays,
          }
        : {}),
    });
  }
}

export const userRepository = new UserRepository();
