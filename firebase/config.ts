import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, type Persistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  return app;
}

/**
 * React Native build of @firebase/auth exports this; the default firebase/auth
 * typings are browser-oriented and omit it.
 */
function reactNativePersistence(): Persistence {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rnAuth = require('@firebase/auth') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };
  return rnAuth.getReactNativePersistence(AsyncStorage);
}

/**
 * Auth with AsyncStorage persistence on native so the session survives
 * process death (swiped away), like Swiggy / Zomato. Web keeps browser defaults.
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (Platform.OS === 'web') {
      auth = getAuth(firebaseApp);
    } else {
      try {
        auth = initializeAuth(firebaseApp, {
          persistence: reactNativePersistence(),
        });
      } catch {
        // Hot reload / already initialized in this JS runtime.
        auth = getAuth(firebaseApp);
      }
    }
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getFirebaseApp());
  }
  return functions;
}

export const COLLECTIONS = {
  users: 'users',
  habits: 'habits',
  goals: 'goals',
  tasks: 'tasks',
  reminders: 'reminders',
  behaviourEvents: 'behaviour_events',
  weeklyReports: 'weekly_reports',
  monthlyReports: 'monthly_reports',
  milestoneReports: 'milestone_reports',
  notifications: 'notifications',
  settings: 'settings',
  premium: 'premium',
  analytics: 'analytics',
  adminCrashLogs: 'admin_crash_logs',
  adminFeatureFlags: 'admin_feature_flags',
} as const;

/** Subcollections under users/{uid} for scalable sharding */
export function userSubcollection(uid: string, name: keyof typeof COLLECTIONS): string {
  return `users/${uid}/${COLLECTIONS[name]}`;
}

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
