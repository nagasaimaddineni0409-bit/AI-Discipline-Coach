import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Vibration, Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Button, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SNOOZE_OPTIONS } from '../constants/categories';
import { useAlarmStore } from '../features/alarm/alarmStore';
import { completeTask, skipTask, snoozeTask } from '../services/reminderActions';
import { useBrandPalette } from '../hooks/useBrandPalette';
import type { SnoozeDurationMinutes } from '../types';

/**
 * Full-screen ringing alarm. This is the product differentiator:
 * the user must Complete / Skip / Snooze — and that action feeds BDI.
 */
export function AlarmRingHost() {
  const active = useAlarmStore((s) => s.active);
  const clearAlarm = useAlarmStore((s) => s.clearAlarm);
  const palette = useBrandPalette();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function startRinging() {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        const uri = active?.reminder.customToneUri;
        if (uri) {
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: true, isLooping: true, volume: 1 },
          );
          if (cancelled) {
            await sound.unloadAsync();
            return;
          }
          soundRef.current = sound;
        }
      } catch {
        // Fall through to vibration if the custom file can't play.
      }

      // Persistent vibration pattern — works even when no custom audio is available.
      Vibration.vibrate(
        Platform.OS === 'android'
          ? [0, 800, 400, 800, 400, 800]
          : [800, 400],
        true,
      );
    }

    void startRinging();

    return () => {
      cancelled = true;
      Vibration.cancel();
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        void sound.stopAsync().finally(() => void sound.unloadAsync());
      }
    };
  }, [active]);

  async function stopRinging() {
    Vibration.cancel();
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch {
        // ignore
      }
    }
  }

  async function run(action: () => Promise<void>) {
    if (!active || acting) return;
    setActing(true);
    try {
      await stopRinging();
      await action();
      clearAlarm();
      setSnoozeOpen(false);
    } finally {
      setActing(false);
    }
  }

  if (!active) return null;

  const { task, reminder } = active;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <LinearGradient
        colors={['#071018', '#0A3D3A', '#14B8A6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text variant="labelLarge" style={styles.eyebrow}>
          DISCIPLINE ALARM
        </Text>
        <Text variant="displaySmall" style={styles.title}>
          {task.title}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {task.description || 'Time to follow through.'}
        </Text>
        <Text variant="headlineMedium" style={styles.time}>
          {task.scheduledTime}
        </Text>
        <Text variant="bodySmall" style={styles.hint}>
          Your choice is recorded. Skipping and snoozing lower your discipline score.
        </Text>

        <View style={styles.actions}>
          <Button
            mode="contained"
            loading={acting}
            disabled={acting}
            onPress={() =>
              run(() => completeTask(task, task.status === 'snoozed'))
            }
            buttonColor="#F3F7F5"
            textColor="#071018"
            contentStyle={styles.primaryBtn}
            labelStyle={styles.primaryLabel}
          >
            Completed
          </Button>
          <Button
            mode="outlined"
            disabled={acting}
            onPress={() => run(() => skipTask(task))}
            textColor="#F3F7F5"
            style={styles.outlineBtn}
            contentStyle={styles.secondaryBtn}
          >
            Skip
          </Button>
          <Button
            mode="text"
            disabled={acting}
            onPress={() => setSnoozeOpen((v) => !v)}
            textColor={palette.accentText}
          >
            Snooze
          </Button>
        </View>

        {snoozeOpen ? (
          <View style={styles.snoozeGrid}>
            {SNOOZE_OPTIONS.map((opt) => (
              <Button
                key={opt.minutes}
                mode="contained-tonal"
                disabled={acting}
                onPress={() =>
                  run(() => snoozeTask(task, opt.minutes as SnoozeDurationMinutes, reminder.id))
                }
                style={styles.snoozeChip}
              >
                {opt.label}
              </Button>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    color: 'rgba(243,247,245,0.7)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#F3F7F5',
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(243,247,245,0.85)',
    marginTop: 10,
  },
  time: {
    color: '#2DD4BF',
    marginTop: 24,
    fontWeight: '700',
  },
  hint: {
    color: 'rgba(243,247,245,0.65)',
    marginTop: 12,
    marginBottom: 28,
  },
  actions: {
    gap: 10,
  },
  primaryBtn: {
    height: 54,
  },
  primaryLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
  outlineBtn: {
    borderColor: 'rgba(243,247,245,0.45)',
    borderRadius: 14,
  },
  secondaryBtn: {
    height: 48,
  },
  snoozeGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  snoozeChip: {
    borderRadius: 12,
  },
});
