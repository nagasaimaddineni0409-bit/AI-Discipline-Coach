import { create } from 'zustand';
import type { UserSettings, ThemeMode } from '../../types';
import { COLLECTIONS } from '../../firebase/config';
import { FirestoreRepository } from '../../database/baseRepository';

const defaultSettings = (userId: string): UserSettings => ({
  userId,
  theme: 'system',
  language: 'en',
  notificationsEnabled: true,
  reminderSoundsEnabled: true,
  weeklyEmailEnabled: true,
  defaultReminderToneId: 'default',
  updatedAt: new Date().toISOString(),
});

class SettingsRepository extends FirestoreRepository {
  async fetch(userId: string): Promise<UserSettings> {
    const existing = await this.get<UserSettings>(COLLECTIONS.settings, userId);
    if (existing) return existing;
    const settings = defaultSettings(userId);
    await this.set(COLLECTIONS.settings, userId, settings);
    return settings;
  }

  async save(userId: string, data: Partial<UserSettings>) {
    await this.update(COLLECTIONS.settings, userId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }
}

const settingsRepo = new SettingsRepository();

interface SettingsState {
  settings: UserSettings | null;
  loading: boolean;
  load: (userId: string) => Promise<void>;
  setTheme: (userId: string, theme: ThemeMode) => Promise<void>;
  patch: (userId: string, data: Partial<UserSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,
  load: async (userId) => {
    set({ loading: true });
    const settings = await settingsRepo.fetch(userId);
    set({ settings, loading: false });
  },
  setTheme: async (userId, theme) => {
    await settingsRepo.save(userId, { theme });
    const current = get().settings;
    if (current) set({ settings: { ...current, theme } });
  },
  patch: async (userId, data) => {
    await settingsRepo.save(userId, data);
    const current = get().settings;
    if (current) set({ settings: { ...current, ...data } });
  },
}));
