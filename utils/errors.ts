import { ZodError } from 'zod';

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with that email. Tap "Create account" to register.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential':
    'Incorrect email or password. If you don\u2019t have an account yet, tap "Create account".',
  'auth/invalid-login-credentials':
    'Incorrect email or password. If you don\u2019t have an account yet, tap "Create account".',
  'auth/email-already-in-use': 'An account already exists with that email.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for the project.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
};

function hasCode(e: unknown): e is { code: string } {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string';
}

/**
 * Converts thrown errors (Zod validation, Firebase auth, generic) into a single
 * user-friendly message. Prevents raw ZodError JSON or Firebase codes leaking to the UI.
 */
export function formatAuthError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof ZodError) {
    return e.issues[0]?.message ?? fallback;
  }
  if (hasCode(e)) {
    const mapped = FIREBASE_AUTH_MESSAGES[e.code];
    if (mapped) return mapped;
  }
  if (e instanceof Error && e.message) {
    // Strip Firebase's "Firebase: ... (auth/...)." wrapper if present.
    const match = e.message.match(/\(([a-z-]+\/[a-z-]+)\)/);
    if (match && FIREBASE_AUTH_MESSAGES[match[1]]) {
      return FIREBASE_AUTH_MESSAGES[match[1]];
    }
    return e.message;
  }
  return fallback;
}
