import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@discipline_ai_cache:';

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheRemove(key: string): Promise<void> {
  await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
}

export async function cacheClearAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const appKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
  await AsyncStorage.multiRemove(appKeys);
}
