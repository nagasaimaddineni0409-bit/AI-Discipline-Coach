import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { UserProfile } from '../../types';
import { userRepository } from '../../database/userRepository';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  initialized: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  refreshProfile: async () => {
    const uid = get().user?.uid;
    if (!uid) return;
    const profile = await userRepository.getProfile(uid);
    set({ profile });
  },
}));
