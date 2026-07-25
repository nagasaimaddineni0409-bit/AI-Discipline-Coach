import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase/config';
import { userRepository } from '../database/userRepository';
import { useAuthStore } from '../features/auth/authStore';

export function useAuthBootstrap() {
  const { setUser, setProfile, setInitialized, setLoading } = useAuthStore();

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setUser(user);
      if (user) {
        const profile = await userRepository.ensureProfile(
          user.uid,
          user.email ?? '',
          user.displayName ?? '',
        );
        setProfile(profile);
      } else {
        setProfile(null);
      }
      setLoading(false);
      setInitialized(true);
    });
    return unsub;
  }, [setUser, setProfile, setInitialized, setLoading]);
}
