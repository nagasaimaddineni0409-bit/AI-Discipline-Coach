import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';

interface Props {
  score: number;
  /** 7-day completion rate minus 30-day rate (percentage points). */
  weeklyChange: number;
  /** Absolute 30-day completion rhythm (0–100). */
  monthlyChange: number;
}

function weekLabel(weeklyChange: number): { title: string; detail: string } {
  if (weeklyChange > 0) {
    return {
      title: 'This week',
      detail: `${weeklyChange} points better than your usual month`,
    };
  }
  if (weeklyChange < 0) {
    return {
      title: 'This week',
      detail: `${Math.abs(weeklyChange)} points below your usual month`,
    };
  }
  return {
    title: 'This week',
    detail: 'About the same as your usual month',
  };
}

export function BdiCard({ score, weeklyChange, monthlyChange }: Props) {
  const theme = useTheme();
  const week = weekLabel(weeklyChange);
  const weekColor =
    weeklyChange > 0
      ? theme.colors.primary
      : weeklyChange < 0
        ? theme.colors.error
        : theme.colors.onSurfaceVariant;

  return (
    <AppCard featured>
      <Text variant="labelLarge">Discipline score</Text>
      <Text variant="displaySmall" style={styles.score}>
        {score}
      </Text>
      <Text variant="bodySmall" style={styles.scoreHint}>
        Based on how you handle reminders
      </Text>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            {week.title}
          </Text>
          <Text variant="bodyMedium" style={{ color: weekColor, lineHeight: 20 }}>
            {week.detail}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            Last 30 days
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.primary, lineHeight: 20 }}>
            Finished reminders on {monthlyChange}% of days
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  score: {
    marginTop: 4,
    fontWeight: '700',
  },
  scoreHint: {
    opacity: 0.7,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'column',
    gap: 10,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    opacity: 0.7,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
});
