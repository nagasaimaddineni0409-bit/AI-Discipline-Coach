import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, HelperText, Text, useTheme } from 'react-native-paper';
import {
  dateToHHmm,
  formatHHmmTo12Hour,
  from12HourParts,
  hhmmToDate,
  to12HourParts,
} from '../utils/time';

interface Props {
  value: string;
  onChange: (hhmm: string) => void;
  error?: string;
  label?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function ReminderTimePicker({
  value,
  onChange,
  error,
  label = 'Reminder time',
}: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const parts = useMemo(() => to12HourParts(value), [value]);
  const [draftHour, setDraftHour] = useState(parts.hour12);
  const [draftMinute, setDraftMinute] = useState(parts.minutes);
  const [draftPeriod, setDraftPeriod] = useState<'AM' | 'PM'>(parts.period);

  function openPicker() {
    const next = to12HourParts(value);
    setDraftHour(next.hour12);
    setDraftMinute(next.minutes);
    setDraftPeriod(next.period);
    if (Platform.OS === 'android') {
      setAndroidOpen(true);
    } else {
      setOpen(true);
    }
  }

  function applyDraft() {
    onChange(from12HourParts(draftHour, draftMinute, draftPeriod));
    setOpen(false);
  }

  function onNativeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setAndroidOpen(false);
      if (event.type === 'dismissed' || !selected) return;
      onChange(dateToHHmm(selected));
      return;
    }
    if (selected) {
      onChange(dateToHHmm(selected));
    }
  }

  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: error ? theme.colors.error : theme.colors.outline,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatHHmmTo12Hour(value)}`}
      >
        <Text variant="bodyLarge">{formatHHmmTo12Hour(value)}</Text>
        <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
          Change
        </Text>
      </Pressable>
      <HelperText type="error" visible={Boolean(error)}>
        {error}
      </HelperText>

      {Platform.OS === 'android' && androidOpen ? (
        <DateTimePicker
          value={hhmmToDate(value)}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onNativeChange}
        />
      ) : null}

      {Platform.OS === 'ios' && open ? (
        <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.elevation.level3 }]}>
              <Text variant="titleMedium" style={styles.sheetTitle}>
                Select reminder time
              </Text>
              <DateTimePicker
                value={hhmmToDate(value)}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={onNativeChange}
                themeVariant={theme.dark ? 'dark' : 'light'}
              />
              <Button mode="contained" onPress={() => setOpen(false)}>
                Done
              </Button>
            </View>
          </View>
        </Modal>
      ) : null}

      {Platform.OS === 'web' && open ? (
        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: theme.colors.elevation.level3 }]}>
              <Text variant="titleMedium" style={styles.sheetTitle}>
                Select reminder time
              </Text>
              <Text variant="labelLarge" style={styles.pickerLabel}>
                Hour
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                <View style={styles.chips}>
                  {HOURS_12.map((h) => (
                    <Button
                      key={h}
                      compact
                      mode={draftHour === h ? 'contained' : 'outlined'}
                      onPress={() => setDraftHour(h)}
                    >
                      {String(h)}
                    </Button>
                  ))}
                </View>
              </ScrollView>
              <Text variant="labelLarge" style={styles.pickerLabel}>
                Minute
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
                <View style={styles.chips}>
                  {MINUTES.filter((m) => m % 5 === 0 || m === draftMinute).map((m) => (
                    <Button
                      key={m}
                      compact
                      mode={draftMinute === m ? 'contained' : 'outlined'}
                      onPress={() => setDraftMinute(m)}
                    >
                      {String(m).padStart(2, '0')}
                    </Button>
                  ))}
                </View>
              </ScrollView>
              <Text variant="labelLarge" style={styles.pickerLabel}>
                Period
              </Text>
              <View style={styles.chips}>
                {(['AM', 'PM'] as const).map((p) => (
                  <Button
                    key={p}
                    mode={draftPeriod === p ? 'contained' : 'outlined'}
                    onPress={() => setDraftPeriod(p)}
                  >
                    {p}
                  </Button>
                ))}
              </View>
              <Text variant="titleMedium" style={styles.preview}>
                {draftHour}:{String(draftMinute).padStart(2, '0')} {draftPeriod}
              </Text>
              <View style={styles.actions}>
                <Button onPress={() => setOpen(false)}>Cancel</Button>
                <Button mode="contained" onPress={applyDraft}>
                  Set time
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  label: {
    marginBottom: 8,
  },
  trigger: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  sheetTitle: {
    marginBottom: 8,
  },
  pickerLabel: {
    marginTop: 8,
  },
  rowScroll: {
    maxHeight: 52,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  preview: {
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
