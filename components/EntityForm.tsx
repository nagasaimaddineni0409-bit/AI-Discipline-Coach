import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, useTheme } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import type { HabitCategory, ScheduleFrequency } from '../types';
import { HABIT_CATEGORIES, PRIORITY_OPTIONS, REMINDER_TONES } from '../constants/categories';
import { FormTextField } from './FormTextField';
import { ReminderTimePicker } from './ReminderTimePicker';
import { ScheduleScheduler } from './ScheduleScheduler';

export interface EntityFormValues {
  title: string;
  description: string;
  category: HabitCategory;
  customCategoryLabel: string;
  priority: (typeof PRIORITY_OPTIONS)[number]['id'];
  notes: string;
  reminderTime: string;
  reminderEnabled: boolean;
  toneId: string;
  customToneUri?: string | null;
  customToneName?: string | null;
  color: string;
  icon: string;
  frequency: ScheduleFrequency;
  interval: number;
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
}

interface Props {
  values: EntityFormValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<EntityFormValues>) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  extraFields?: React.ReactNode;
  onCancel?: () => void;
  /** When editing, keep an existing past start date valid until the user changes it. */
  originalStartDate?: string | null;
}

export function EntityForm({
  values,
  errors,
  onChange,
  onSubmit,
  submitLabel,
  loading,
  extraFields,
  onCancel,
  originalStartDate,
}: Props) {
  const theme = useTheme();

  async function pickCustomTone() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      onChange({
        toneId: 'custom',
        customToneUri: asset.uri,
        customToneName: asset.name ?? 'Custom track',
      });
    } catch {
      // User cancelled or picker unavailable.
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <FormTextField
        label="Title"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        error={Boolean(errors.title)}
      />
      <HelperText type="error" visible={Boolean(errors.title)}>
        {errors.title}
      </HelperText>

      <FormTextField
        label="Description"
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        numberOfLines={3}
      />

      <Text variant="labelLarge" style={styles.section}>
        Category
      </Text>
      <View style={styles.chips}>
        {HABIT_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            mode={values.category === cat.id ? 'contained' : 'outlined'}
            onPress={() => onChange({ category: cat.id, color: cat.color, icon: cat.icon })}
            compact
            style={styles.chip}
            contentStyle={styles.chipContent}
          >
            {cat.label}
          </Button>
        ))}
      </View>
      {values.category === 'custom' ? (
        <FormTextField
          label="Custom category"
          value={values.customCategoryLabel}
          onChangeText={(customCategoryLabel) => onChange({ customCategoryLabel })}
          style={styles.afterChips}
        />
      ) : null}

      <Text variant="labelLarge" style={styles.section}>
        Priority
      </Text>
      <View style={styles.chips}>
        {PRIORITY_OPTIONS.map((p) => (
          <Button
            key={p.id}
            mode={values.priority === p.id ? 'contained' : 'outlined'}
            onPress={() => onChange({ priority: p.id })}
            compact
            style={styles.chip}
            contentStyle={styles.chipContent}
          >
            {p.label}
          </Button>
        ))}
      </View>

      <ReminderTimePicker
        value={values.reminderTime}
        onChange={(reminderTime) => onChange({ reminderTime })}
        error={errors.reminderTime}
      />

      <ScheduleScheduler
        value={{
          frequency: values.frequency,
          interval: values.interval,
          daysOfWeek: values.daysOfWeek,
          startDate: values.startDate,
          endDate: values.endDate,
        }}
        onChange={(patch) => onChange(patch)}
        errors={errors}
        originalStartDate={originalStartDate}
      />

      <Text variant="labelLarge" style={styles.section}>
        Alarm tone
      </Text>
      <Text variant="bodySmall" style={styles.toneHint}>
        Default phone alarm sound wakes the device. Pick your own music to play in the full-screen
        alarm until you Complete, Skip, or Snooze.
      </Text>
      <View style={styles.chips}>
        {REMINDER_TONES.map((tone) => (
          <Button
            key={tone.id}
            mode={values.toneId === tone.id ? 'contained' : 'outlined'}
            onPress={() => {
              if (tone.id === 'custom') {
                void pickCustomTone();
              } else {
                onChange({ toneId: tone.id, customToneUri: null, customToneName: null });
              }
            }}
            compact
            style={styles.chip}
            contentStyle={styles.chipContent}
          >
            {tone.label}
          </Button>
        ))}
      </View>
      {values.toneId === 'custom' && values.customToneName ? (
        <Text variant="bodySmall" style={styles.customToneName}>
          Playing: {values.customToneName}
        </Text>
      ) : null}
      {Platform.OS === 'web' && values.toneId === 'custom' ? (
        <HelperText type="info" visible>
          Custom music plays best on a real phone install. Web can still schedule alarms with the
          default tone.
        </HelperText>
      ) : null}

      {extraFields}

      <FormTextField
        label="Notes (optional)"
        value={values.notes}
        onChangeText={(notes) => onChange({ notes })}
        multiline
        numberOfLines={4}
        style={styles.notes}
        placeholder="Anything else you want to remember about this habit"
      />

      <Button
        mode="contained"
        onPress={onSubmit}
        loading={loading}
        style={styles.submit}
        contentStyle={styles.submitContent}
        buttonColor={theme.colors.primary}
      >
        {submitLabel}
      </Button>
      {onCancel ? (
        <Button mode="text" onPress={onCancel} disabled={loading} style={styles.cancel}>
          Cancel
        </Button>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
    gap: 2,
  },
  section: {
    marginTop: 18,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toneHint: {
    opacity: 0.75,
    marginBottom: 10,
  },
  customToneName: {
    marginTop: 8,
    opacity: 0.85,
  },
  chip: {
    borderRadius: 14,
  },
  chipContent: {
    height: 36,
  },
  afterChips: {
    marginTop: 10,
  },
  notes: {
    marginTop: 20,
  },
  submit: {
    marginTop: 24,
    borderRadius: 14,
  },
  submitContent: {
    height: 48,
  },
  cancel: {
    marginTop: 8,
  },
});
