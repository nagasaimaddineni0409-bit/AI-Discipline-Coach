import React, { useState, useEffect, useRef } from 'react';
import { Platform, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Button, Divider, HelperText, Text } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { User } from 'firebase/auth';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  loginWithEmail,
  signInWithGoogleIdToken,
  signInWithGoogleWeb,
  signInWithApple,
  useGoogleAuthRequest,
  isGoogleAuthConfigured,
} from '../../firebase/auth';
import { userRepository } from '../../database/userRepository';
import { useAuthStore } from '../../features/auth/authStore';
import { AuthStackParamList } from '../../navigation/types';
import { emailSchema, passwordSchema } from '../../utils/validation';
import { formatAuthError } from '../../utils/errors';
import { isFirebaseConfigured } from '../../firebase/config';
import { AuthShell } from '../../components/auth/AuthShell';
import { AuthTextField } from '../../components/auth/AuthTextField';
import { AUTH } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

async function syncProfile(user: User) {
  const profile = await userRepository.ensureProfile(
    user.uid,
    user.email ?? '',
    user.displayName ?? '',
  );
  useAuthStore.getState().setProfile(profile);
}

function NativeGoogleButton({
  disabled,
  onError,
  onBusy,
}: {
  disabled?: boolean;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.authentication?.idToken ??
        (response.params as { id_token?: string } | undefined)?.id_token;
      if (!idToken) {
        onError('Google sign-in did not return an ID token. Check your Web client ID setup.');
        return;
      }
      onBusy(true);
      signInWithGoogleIdToken(idToken)
        .then(syncProfile)
        .catch((e) => onError(formatAuthError(e, 'Google sign-in failed')))
        .finally(() => onBusy(false));
    } else if (response?.type === 'error') {
      onError(formatAuthError(response.error, 'Google sign-in failed'));
    }
  }, [response, onError, onBusy]);

  return (
    <Button
      mode="outlined"
      disabled={disabled || !isGoogleAuthConfigured()}
      icon={({ size, color }) => (
        <MaterialCommunityIcons name="google" size={size} color={color} />
      )}
      textColor={AUTH.cream}
      style={styles.outlineBtn}
      contentStyle={styles.btnContent}
      onPress={async () => {
        if (!isGoogleAuthConfigured()) {
          onError(
            'Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to `.env`, then restart Expo.',
          );
          return;
        }
        try {
          onBusy(true);
          await promptAsync();
        } catch (e) {
          onError(formatAuthError(e, 'Google sign-in failed'));
        } finally {
          onBusy(false);
        }
      }}
    >
      Continue with Google
    </Button>
  );
}

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<RNTextInput>(null);

  async function onLogin() {
    if (loading) return;
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      emailSchema.parse(normalizedEmail);
      passwordSchema.parse(password);
      setLoading(true);
      const user = await loginWithEmail(normalizedEmail, password);
      await syncProfile(user);
    } catch (e) {
      setError(formatAuthError(e, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleWeb() {
    setError('');
    try {
      setLoading(true);
      const user = await signInWithGoogleWeb();
      await syncProfile(user);
    } catch (e) {
      setError(formatAuthError(e, 'Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onApple() {
    setError('');
    try {
      setLoading(true);
      const user = await signInWithApple();
      if (user) await syncProfile(user);
    } catch (e) {
      setError(formatAuthError(e, 'Apple sign-in failed'));
    } finally {
      setLoading(false);
    }
  }

  const fields = (
    <>
      {!isFirebaseConfigured() ? (
        <HelperText type="info" visible style={styles.warn}>
          Configure Firebase in `.env` to enable cloud sync.
        </HelperText>
      ) : null}

      <AuthTextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthTextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={onLogin}
      />

      <Button
        mode="contained"
        onPress={onLogin}
        loading={loading}
        buttonColor={AUTH.teal}
        textColor={AUTH.ink}
        style={styles.primaryBtn}
        contentStyle={styles.btnContent}
        labelStyle={styles.primaryLabel}
      >
        Sign in
      </Button>

      <View style={styles.dividerRow}>
        <Divider style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <Divider style={styles.dividerLine} />
      </View>

      {Platform.OS === 'web' ? (
        <Button
          mode="outlined"
          onPress={onGoogleWeb}
          disabled={loading}
          icon={({ size, color }) => (
            <MaterialCommunityIcons name="google" size={size} color={color} />
          )}
          textColor={AUTH.cream}
          style={styles.outlineBtn}
          contentStyle={styles.btnContent}
        >
          Continue with Google
        </Button>
      ) : isGoogleAuthConfigured() ? (
        <NativeGoogleButton disabled={loading} onError={setError} onBusy={setLoading} />
      ) : (
        <Button
          mode="outlined"
          disabled
          textColor={AUTH.mist}
          style={styles.outlineBtn}
          contentStyle={styles.btnContent}
          onPress={() =>
            setError(
              'Google Sign-In is not configured. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to `.env`, then restart Expo.',
            )
          }
        >
          Continue with Google
        </Button>
      )}

      {Platform.OS === 'ios' ? (
        <Button
          mode="text"
          onPress={onApple}
          disabled={loading}
          textColor={AUTH.mist}
          style={styles.textBtn}
        >
          Continue with Apple
        </Button>
      ) : null}

      <Button
        mode="text"
        onPress={() => navigation.navigate('Register')}
        textColor={AUTH.tealSoft}
        style={styles.textBtn}
        labelStyle={styles.linkLabel}
      >
        New here? Create an account
      </Button>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <AuthShell>
      {Platform.OS === 'web' ? (
        // Lets the browser treat Enter as form submit.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onLogin();
          }}
        >
          {fields}
        </form>
      ) : (
        fields
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    marginTop: 8,
    borderRadius: 14,
  },
  outlineBtn: {
    borderRadius: 14,
    borderColor: AUTH.panelBorder,
  },
  textBtn: {
    marginTop: 4,
  },
  btnContent: {
    height: 48,
  },
  primaryLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  linkLabel: {
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    backgroundColor: AUTH.panelBorder,
  },
  dividerText: {
    color: AUTH.mist,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  error: {
    color: AUTH.danger,
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  warn: {
    color: AUTH.warn,
    marginBottom: 8,
  },
});
