import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { registerWithEmail } from '../../firebase/auth';
import { userRepository } from '../../database/userRepository';
import { AuthStackParamList } from '../../navigation/types';
import { emailSchema, passwordSchema } from '../../utils/validation';
import { formatAuthError } from '../../utils/errors';
import { AuthShell } from '../../components/auth/AuthShell';
import { AuthTextField } from '../../components/auth/AuthTextField';
import { AUTH } from '../../constants/theme';
import { useAuthStore } from '../../features/auth/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const setProfile = useAuthStore((s) => s.setProfile);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    const name = displayName.trim();
    try {
      if (!name) throw new Error('Display name is required');
      emailSchema.parse(normalizedEmail);
      passwordSchema.parse(password);
      setLoading(true);
      const user = await registerWithEmail(normalizedEmail, password, name);
      // Pass the chosen display name explicitly — Auth state may race before updateProfile lands.
      const profile = await userRepository.ensureProfile(
        user.uid,
        user.email ?? normalizedEmail,
        name,
      );
      setProfile(profile);
    } catch (e) {
      setError(formatAuthError(e, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Start your streak"
      title="Create account"
      subtitle="Set up a profile so Discipline AI can track how you respond to reminders."
    >
      <AuthTextField
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        returnKeyType="next"
        blurOnSubmit={false}
      />
      <AuthTextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="next"
        blurOnSubmit={false}
      />
      <AuthTextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={onRegister}
      />

      <Button
        mode="contained"
        onPress={onRegister}
        loading={loading}
        buttonColor={AUTH.teal}
        textColor={AUTH.ink}
        style={styles.primaryBtn}
        contentStyle={styles.btnContent}
        labelStyle={styles.primaryLabel}
      >
        Create account
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.goBack()}
        textColor={AUTH.tealSoft}
        style={styles.textBtn}
      >
        Already have an account? Sign in
      </Button>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    marginTop: 8,
    borderRadius: 14,
  },
  textBtn: {
    marginTop: 8,
  },
  btnContent: {
    height: 48,
  },
  primaryLabel: {
    fontWeight: '700',
  },
  error: {
    color: AUTH.danger,
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
  },
});
