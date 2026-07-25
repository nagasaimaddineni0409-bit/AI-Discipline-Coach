import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  User,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { getFirebaseAuth } from './config';

WebBrowser.maybeCompleteAuthSession();

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function deleteAuthUser(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (user) {
    await deleteUser(user);
  }
}

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });
}

export async function signInWithGoogleIdToken(idToken: string): Promise<User> {
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(getFirebaseAuth(), credential);
  return cred.user;
}

export async function signInWithApple(): Promise<User | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'web') {
    return null;
  }
  try {
    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!appleCredential.identityToken) {
      throw new Error('Apple Sign-In failed: no identity token');
    }
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken,
    });
    const cred = await signInWithCredential(getFirebaseAuth(), credential);
    if (appleCredential.fullName?.givenName && !cred.user.displayName) {
      const name = [appleCredential.fullName.givenName, appleCredential.fullName.familyName]
        .filter(Boolean)
        .join(' ');
      await updateProfile(cred.user, { displayName: name });
    }
    return cred.user;
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw e;
  }
}
