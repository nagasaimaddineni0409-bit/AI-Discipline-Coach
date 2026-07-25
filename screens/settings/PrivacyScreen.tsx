import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/AppCard';

export function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AppCard>
        <Text variant="titleMedium">Privacy</Text>
        <Text variant="bodyMedium" style={styles.body}>
          Discipline AI stores behavioural interaction data in Firebase Cloud Firestore to generate
          your discipline score, reports, and insights. Data is tied to your authenticated account
          and protected by Firebase security rules. You may export or delete your data from Settings.
        </Text>
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  body: { marginTop: 8, lineHeight: 22 },
});
