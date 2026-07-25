import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';

interface Props {
  score: number;
  weeklyChange: number;
  monthlyChange: number;
}

export function BdiCard({ score, weeklyChange, monthlyChange }: Props) {
  const theme = useTheme();
  const weeklyColor = weeklyChange >= 0 ? theme.colors.primary : theme.colors.error;
  const monthlyColor = monthlyChange >= 0 ? theme.colors.primary : theme.colors.error;

  return (
    <AppCard>
      <Text variant="labelLarge">Behavioural Discipline Index</Text>
      <Text variant="displaySmall" style={styles.score}>
        {score}
      </Text>
      <View style={styles.row}>
        <Text variant="bodyMedium" style={{ color: weeklyColor }}>
          Weekly {weeklyChange >= 0 ? '+' : ''}
          {weeklyChange}
        </Text>
        <Text variant="bodyMedium" style={{ color: monthlyColor }}>
          Monthly {monthlyChange >= 0 ? '+' : ''}
          {monthlyChange}
        </Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  score: {
    marginVertical: 8,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
