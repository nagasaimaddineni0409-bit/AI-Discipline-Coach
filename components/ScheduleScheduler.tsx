import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, useTheme } from 'react-native-paper';
import type { ScheduleFrequency } from '../types';
import { FREQUENCY_OPTIONS, WEEKDAYS, describeSchedule } from '../utils/schedule';
import { todayDateKey } from '../utils/date';
import { DatePickerField } from './DatePickerField';

export interface ScheduleValue {
  frequency: ScheduleFrequency;
  interval: number;
  daysOfWeek: number[];
  startDate: string;
  endDate?: string | null;
}

interface Props {
  value: ScheduleValue;
  onChange: (patch: Partial<ScheduleValue>) => void;
  errors?: Record<string, string>;
  /** Existing start date when editing — kept selectable even if it is in the past. */
  originalStartDate?: string | null;
}

function maxKey(...keys: Array<string | null | undefined>): string {
  const today = todayDateKey();
  const valid = keys.filter((k): k is string => Boolean(k && /^\d{4}-\d{2}-\d{2}$/.test(k)));
  return valid.length ? valid.sort().at(-1)! : today;
}

export function ScheduleScheduler({ value, onChange, errors, originalStartDate }: Props) {
  const theme = useTheme();
  const today = todayDateKey();

  // New setups cannot pick past days. Editing may keep the original start date.
  const startMinimum = useMemo(() => {
    if (originalStartDate && originalStartDate < today) return originalStartDate;
    return today;
  }, [originalStartDate, today]);

  const endMinimum = useMemo(
    () => maxKey(value.startDate, today),
    [value.startDate, today],
  );

  function toggleDay(index: number) {
    const set = new Set(value.daysOfWeek);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    onChange({ daysOfWeek: Array.from(set).sort((a, b) => a - b) });
  }

  const showInterval =
    value.frequency === 'daily' ||
    value.frequency === 'weekly' ||
    value.frequency === 'monthly' ||
    value.frequency === 'yearly';

  const unitLabel =
    value.frequency === 'daily'
      ? 'day(s)'
      : value.frequency === 'weekly'
        ? 'week(s)'
        : value.frequency === 'monthly'
          ? 'month(s)'
          : 'year(s)';

  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge" style={styles.section}>
        Repeat
      </Text>
      <View style={styles.chips}>
        {FREQUENCY_OPTIONS.map((opt) => (
          <Button
            key={opt.id}
            compact
            mode={value.frequency === opt.id ? 'contained' : 'outlined'}
            onPress={() => onChange({ frequency: opt.id })}
            style={styles.chip}
            contentStyle={styles.chipContent}
          >
            {opt.label}
          </Button>
        ))}
      </View>

      {value.frequency === 'weekly' ? (
        <>
          <Text variant="labelMedium" style={styles.subLabel}>
            On these days
          </Text>
          <View style={styles.days}>
            {WEEKDAYS.map((d) => {
              const active = value.daysOfWeek.includes(d.index);
              return (
                <Button
                  key={d.index}
                  compact
                  mode={active ? 'contained' : 'outlined'}
                  onPress={() => toggleDay(d.index)}
                  style={styles.dayBtn}
                >
                  {d.short}
                </Button>
              );
            })}
          </View>
        </>
      ) : null}

      {showInterval ? (
        <View style={styles.intervalRow}>
          <Text variant="bodyMedium">Every</Text>
          <IconButton
            icon="minus"
            size={18}
            mode="outlined"
            onPress={() => onChange({ interval: Math.max(1, value.interval - 1) })}
          />
          <Text variant="titleMedium" style={styles.intervalValue}>
            {value.interval}
          </Text>
          <IconButton
            icon="plus"
            size={18}
            mode="outlined"
            onPress={() => onChange({ interval: Math.min(52, value.interval + 1) })}
          />
          <Text variant="bodyMedium">{unitLabel}</Text>
        </View>
      ) : null}

      <DatePickerField
        label={value.frequency === 'once' ? 'Date' : 'Start date'}
        value={value.startDate}
        onChange={(d) => {
          const next = d ?? value.startDate;
          onChange({
            startDate: next,
            // Keep end date valid relative to the new start.
            endDate: value.endDate && value.endDate < next ? null : value.endDate,
          });
        }}
        minimumDateKey={startMinimum}
        error={errors?.startDate}
      />

      {value.frequency !== 'once' ? (
        <DatePickerField
          label="End date (optional)"
          value={value.endDate ?? null}
          onChange={(d) => onChange({ endDate: d })}
          optional
          minimumDateKey={endMinimum}
          error={errors?.endDate}
        />
      ) : null}

      <Text variant="labelMedium" style={[styles.summary, { color: theme.colors.primary }]}>
        {describeSchedule({
          frequency: value.frequency,
          interval: value.interval,
          daysOfWeek: value.daysOfWeek,
          startDate: value.startDate,
          endDate: value.endDate,
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  section: { marginTop: 16, marginBottom: 8 },
  subLabel: { marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 14 },
  chipContent: { height: 36 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBtn: { minWidth: 48, borderRadius: 14 },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  intervalValue: { minWidth: 24, textAlign: 'center' },
  summary: { marginTop: 12 },
});
