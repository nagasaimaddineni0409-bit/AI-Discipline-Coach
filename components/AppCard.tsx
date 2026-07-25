import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function AppCard({ children, style, elevated = true }: Props) {
  const theme = useTheme();
  return (
    <Surface
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.elevation.level2,
        },
        style,
      ]}
      elevation={elevated ? 2 : 0}
    >
      <View style={styles.inner}>{children}</View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 12,
  },
  inner: {
    padding: 16,
  },
});
