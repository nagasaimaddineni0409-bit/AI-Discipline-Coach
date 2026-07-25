import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

interface Props {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: Props) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator animating size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    marginTop: 12,
  },
});
