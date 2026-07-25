import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { registerWithEmail } from '../../firebase/auth';
import { userRepository } from '../../database/userRepository';
import { AuthStackParamList } from '../../navigation/types';
import { emailSchema, passwordSchema } from '../../utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    setError('');
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!displayName.trim()) throw new Error('Display name is required');
      setLoading(true);
      const user = await registerWithEmail(email.trim(), password, displayName.trim());
      await userRepository.ensureProfile(user.uid, user.email ?? email, displayName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Create account</Text>
      <TextInput label="Display name" value={displayName} onChangeText={setDisplayName} />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button mode="contained" onPress={onRegister} loading={loading} style={styles.btn}>
        Register
      </Button>
      <Button mode="text" onPress={() => navigation.goBack()}>
        Back to sign in
      </Button>
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
  btn: {
    marginTop: 12,
  },
  error: {
    color: '#B00020',
    marginTop: 12,
  },
});
