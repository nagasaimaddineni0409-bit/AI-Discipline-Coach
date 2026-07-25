import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
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
