import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  loginWithEmail,
  signInWithGoogleIdToken,
  signInWithApple,
  useGoogleAuthRequest,
} from '../../firebase/auth';
import { userRepository } from '../../database/userRepository';
import { AuthStackParamList } from '../../navigation/types';
import { emailSchema, passwordSchema } from '../../utils/validation';
import { formatAuthError } from '../../utils/errors';
import { isFirebaseConfigured } from '../../firebase/config';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [request, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.authentication?.idToken;
      if (idToken) {
        setLoading(true);
        signInWithGoogleIdToken(idToken)
          .then(async (user) => {
            await userRepository.ensureProfile(
              user.uid,
              user.email ?? '',
              user.displayName ?? '',
            );
          })
          .catch((e) => setError(formatAuthError(e, 'Google sign-in failed')))
          .finally(() => setLoading(false));
      }
    }
  }, [response]);

  async function onLogin() {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    try {
      emailSchema.parse(normalizedEmail);
      passwordSchema.parse(password);
      setLoading(true);
      const user = await loginWithEmail(normalizedEmail, password);
      await userRepository.ensureProfile(
        user.uid,
        user.email ?? normalizedEmail,
        user.displayName ?? '',
      );
    } catch (e) {
      setError(formatAuthError(e, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  async function onApple() {
    setError('');
    try {
      setLoading(true);
      const user = await signInWithApple();
      if (user) {
        await userRepository.ensureProfile(user.uid, user.email ?? '', user.displayName ?? '');
      }
    } catch (e) {
      setError(formatAuthError(e, 'Apple sign-in failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Discipline AI</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Measure behaviour. Build discipline.
      </Text>
      {!isFirebaseConfigured() ? (
        <Text variant="bodySmall" style={styles.warn}>
          Configure Firebase in `.env` (see `.env.example`) to enable cloud sync.
        </Text>
      ) : null}
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <View style={styles.form}>
        <Button mode="contained" onPress={onLogin} loading={loading}>
          Sign in with Email
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('Register')}>
          Create account
        </Button>
        {request ? (
          <Button mode="outlined" onPress={() => promptAsync()}>
            Continue with Google
          </Button>
        ) : null}
        <Button mode="text" onPress={onApple}>
          Continue with Apple
        </Button>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 8,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.75,
  },
  input: {
    marginBottom: 8,
  },
  form: {
    gap: 12,
    marginTop: 8,
  },
  error: {
    color: '#B00020',
    marginTop: 12,
  },
  warn: {
    marginBottom: 12,
    color: '#E65100',
  },
});
