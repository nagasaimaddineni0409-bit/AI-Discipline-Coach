import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import type { HabitCategory } from '../types';
import { HABIT_CATEGORIES, PRIORITY_OPTIONS, REMINDER_TONES } from '../constants/categories';

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
  color: string;
  icon: string;
}

interface Props {
  values: EntityFormValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<EntityFormValues>) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  extraFields?: React.ReactNode;
}

export function EntityForm({
  values,
  errors,
  onChange,
  onSubmit,
  submitLabel,
  loading,
  extraFields,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        label="Title"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        error={Boolean(errors.title)}
      />
      <HelperText type="error" visible={Boolean(errors.title)}>
        {errors.title}
      </HelperText>

      <TextInput
        label="Description"
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        multiline
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
          >
            {cat.label}
          </Button>
        ))}
      </View>
      {values.category === 'custom' ? (
        <TextInput
          label="Custom category"
          value={values.customCategoryLabel}
          onChangeText={(customCategoryLabel) => onChange({ customCategoryLabel })}
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
          >
            {p.label}
          </Button>
        ))}
      </View>

      <TextInput
        label="Notes"
        value={values.notes}
        onChangeText={(notes) => onChange({ notes })}
        multiline
      />

      <TextInput
        label="Reminder time (HH:MM)"
        value={values.reminderTime}
        onChangeText={(reminderTime) => onChange({ reminderTime })}
        error={Boolean(errors.reminderTime)}
      />
      <HelperText type="error" visible={Boolean(errors.reminderTime)}>
        {errors.reminderTime}
      </HelperText>

      <Text variant="labelLarge" style={styles.section}>
        Reminder tone
      </Text>
      <View style={styles.chips}>
        {REMINDER_TONES.map((tone) => (
          <Button
            key={tone.id}
            mode={values.toneId === tone.id ? 'contained' : 'outlined'}
            onPress={() => onChange({ toneId: tone.id })}
            compact
          >
            {tone.label}
          </Button>
        ))}
      </View>

      {extraFields}

      <Button mode="contained" onPress={onSubmit} loading={loading} style={styles.submit}>
        {submitLabel}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  submit: {
    marginTop: 24,
  },
});
