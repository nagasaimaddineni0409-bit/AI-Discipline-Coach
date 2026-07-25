import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';
import { SNOOZE_OPTIONS } from '../constants/categories';
import type { Task } from '../types';
import type { SnoozeDurationMinutes } from '../types';

interface Props {
  task: Task;
  visible: boolean;
  onDismiss: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onSnooze: (minutes: SnoozeDurationMinutes) => void;
}

export function ReminderModal({
  task,
  visible,
  onDismiss,
  onComplete,
  onSkip,
  onSnooze,
}: Props) {
  const theme = useTheme();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <AppCard elevated={false} style={{ backgroundColor: theme.colors.surface }}>
          <Text variant="titleLarge">{task.title}</Text>
          <Text variant="bodyMedium" style={styles.desc}>
            {task.description || 'No description'}
          </Text>
          <Text variant="labelLarge" style={styles.time}>
            {task.scheduledTime}
          </Text>
          <View style={styles.actions}>
            <Button mode="contained" onPress={onComplete}>
              Completed
            </Button>
            <Button mode="outlined" onPress={onSkip}>
              Skip
            </Button>
            <Button mode="text" onPress={() => setSnoozeOpen((v) => !v)}>
              Snooze
            </Button>
          </View>
          {snoozeOpen ? (
            <View style={styles.snoozeGrid}>
              {SNOOZE_OPTIONS.map((opt) => (
                <Button key={opt.minutes} compact onPress={() => onSnooze(opt.minutes)}>
                  {opt.label}
                </Button>
              ))}
            </View>
          ) : null}
        </AppCard>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 24,
  },
  desc: {
    marginTop: 8,
    opacity: 0.8,
  },
  time: {
    marginTop: 12,
  },
  actions: {
    marginTop: 16,
    gap: 8,
  },
  snoozeGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
});
