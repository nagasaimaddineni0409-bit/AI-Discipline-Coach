import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/AppCard';
import { ScreenScaffold } from '../../components/ScreenScaffold';

export function PrivacyScreen() {
  return (
    <ScreenScaffold>
    <ScrollView contentContainerStyle={styles.container}>
      <AppCard>
        <Text variant="titleMedium">Privacy</Text>
        <Text variant="bodyMedium" style={styles.body}>
          Discipline AI stores behavioural interaction data in Firebase Cloud Firestore to generate
          your discipline score, reports, and insights. If weekly review email is enabled, a
          summary of those same reminder responses is sent to your registered email each Monday.
          That letter is behavioural coaching from your logged actions, not a medical diagnosis.
          Data is tied to your authenticated account and protected by Firebase security rules.
          You may turn off weekly emails, export, or delete your data from Settings.
        </Text>
      </AppCard>
    </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  body: { marginTop: 8, lineHeight: 22 },
});
