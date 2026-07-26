import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, HelperText, Icon, Text, useTheme } from 'react-native-paper';
import { useBrandPalette } from '../hooks/useBrandPalette';
import { todayDateKey } from '../utils/date';

interface Props {
  label: string;
  value?: string | null;
  onChange: (dateKey: string | null) => void;
  optional?: boolean;
  error?: string;
  /** Earliest selectable day (YYYY-MM-DD). Defaults to today. */
  minimumDateKey?: string;
}

function keyToDate(dateKey?: string | null): Date {
  if (!dateKey) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function formatKey(dateKey?: string | null): string {
  if (!dateKey) return 'Not set';
  return keyToDate(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatHero(dateKey?: string | null): string {
  if (!dateKey) return 'Choose a date';
  return keyToDate(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function clampToMinimum(dateKey: string, minimumDateKey: string): string {
  return dateKey < minimumDateKey ? minimumDateKey : dateKey;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_SIZE = 40;
const GRID_GAP = 4;
const CALENDAR_WIDTH = 7 * DAY_SIZE + 6 * GRID_GAP;

export function DatePickerField({
  label,
  value,
  onChange,
  optional,
  error,
  minimumDateKey = todayDateKey(),
}: Props) {
  const theme = useTheme();
  const palette = useBrandPalette();
  const { width: windowWidth } = useWindowDimensions();
  const [show, setShow] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(keyToDate(value ?? minimumDateKey)));

  const minDate = useMemo(() => keyToDate(minimumDateKey), [minimumDateKey]);
  const minKey = minimumDateKey;
  const todayKey = todayDateKey();

  function openPicker() {
    setCursor(startOfMonth(keyToDate(value && value >= minKey ? value : minKey)));
    setShow(true);
  }

  function selectKey(dateKey: string) {
    if (dateKey < minKey) return;
    onChange(dateKey);
    setShow(false);
  }

  function onNativeChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'dismissed' || !selected) return;
      onChange(clampToMinimum(dateToKey(selected), minKey));
      return;
    }
    if (selected) {
      onChange(clampToMinimum(dateToKey(selected), minKey));
    }
  }

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startPad = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const items: Array<{ key: string; day: number } | null> = [];

    for (let i = 0; i < startPad; i += 1) items.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateToKey(new Date(first.getFullYear(), first.getMonth(), day));
      items.push({ key, day });
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [cursor]);

  const monthTitle = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const prevMonth = addMonths(cursor, -1);
  const lastDayPrev = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
  const canNavigatePrev = dateToKey(lastDayPrev) >= minKey;
  const cardMaxWidth = Math.min(380, windowWidth - 32);

  const calendarBody = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.elevation.level2,
          borderColor: palette.cardBorder,
          maxWidth: cardMaxWidth,
          width: cardMaxWidth,
        },
      ]}
    >
      <View style={[styles.hero, { backgroundColor: palette.accent }]}>
        <Text variant="labelLarge" style={[styles.heroLabel, { color: palette.onAccent }]}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={[styles.heroDate, { color: palette.onAccent }]}>
          {formatHero(value && value >= minKey ? value : null)}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.monthNav}>
          <Pressable
            onPress={() => canNavigatePrev && setCursor(addMonths(cursor, -1))}
            disabled={!canNavigatePrev}
            style={[
              styles.navBtn,
              {
                borderColor: palette.cardBorder,
                opacity: canNavigatePrev ? 1 : 0.35,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Icon source="chevron-left" size={22} color={theme.colors.onSurface} />
          </Pressable>
          <Text variant="titleMedium" style={styles.monthTitle}>
            {monthTitle}
          </Text>
          <Pressable
            onPress={() => setCursor(addMonths(cursor, 1))}
            style={[styles.navBtn, { borderColor: palette.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Icon source="chevron-right" size={22} color={theme.colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.calendarFrame}>
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((d, i) => (
              <View key={`${d}-${i}`} style={styles.weekCell}>
                <Text
                  variant="labelSmall"
                  style={[styles.weekLabel, { color: palette.textMuted }]}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell, index) => {
              if (!cell) {
                return <View key={`empty-${index}`} style={styles.daySlot} />;
              }

              const disabled = cell.key < minKey;
              const selected = value === cell.key;
              const isToday = cell.key === todayKey;

              return (
                <Pressable
                  key={cell.key}
                  disabled={disabled}
                  onPress={() => selectKey(cell.key)}
                  style={styles.daySlot}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={formatKey(cell.key)}
                >
                  <View
                    style={[
                      styles.dayBubble,
                      disabled && {
                        backgroundColor: theme.dark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(11,28,36,0.04)',
                      },
                      !disabled && isToday && !selected && {
                        borderWidth: 1.5,
                        borderColor: palette.accent,
                      },
                      selected && {
                        backgroundColor: palette.accent,
                      },
                    ]}
                  >
                    <Text
                      variant="bodyMedium"
                      style={{
                        fontWeight: selected || isToday ? '700' : '500',
                        color: disabled
                          ? theme.dark
                            ? 'rgba(167,192,187,0.38)'
                            : 'rgba(74,99,96,0.42)'
                          : selected
                            ? palette.onAccent
                            : theme.colors.onSurface,
                        textDecorationLine: disabled ? 'line-through' : 'none',
                      }}
                    >
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text variant="labelSmall" style={[styles.hint, { color: palette.textMuted }]}>
          Past dates can’t be selected
        </Text>

        <View style={styles.quickRow}>
          <Pressable
            disabled={todayKey < minKey}
            onPress={() => selectKey(clampToMinimum(todayKey, minKey))}
            style={[
              styles.quickChip,
              {
                borderColor: palette.cardBorder,
                opacity: todayKey < minKey ? 0.4 : 1,
              },
            ]}
          >
            <Text variant="labelLarge" style={{ color: palette.accentText }}>
              Today
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              selectKey(clampToMinimum(dateToKey(d), minKey));
            }}
            style={[styles.quickChip, { borderColor: palette.cardBorder }]}
          >
            <Text variant="labelLarge" style={{ color: palette.accentText }}>
              Tomorrow
            </Text>
          </Pressable>
          {optional && value ? (
            <Pressable
              onPress={() => {
                onChange(null);
                setShow(false);
              }}
              style={[styles.quickChip, { borderColor: palette.cardBorder }]}
            >
              <Text variant="labelLarge" style={{ color: palette.textMuted }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Button
          mode="contained"
          onPress={() => setShow(false)}
          style={styles.done}
          buttonColor={palette.accent}
          textColor={palette.onAccent}
          contentStyle={styles.doneContent}
        >
          Done
        </Button>
      </View>
    </View>
  );

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
        accessibilityLabel={`${label}, ${formatKey(value)}`}
      >
        <View style={styles.triggerLeft}>
          <Icon source="calendar-month" size={20} color={palette.accentText} />
          <View style={styles.triggerText}>
            <Text variant="bodyLarge">{formatKey(value)}</Text>
            {value && value < minKey ? (
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                Pick a date from today onward
              </Text>
            ) : null}
          </View>
        </View>
        <Text variant="labelMedium" style={{ color: palette.accentText }}>
          {value ? 'Change' : 'Select'}
        </Text>
      </Pressable>

      {optional && value && !show ? (
        <Button compact onPress={() => onChange(null)} style={styles.clear}>
          Clear date
        </Button>
      ) : null}

      <HelperText type="error" visible={Boolean(error)}>
        {error}
      </HelperText>

      {Platform.OS === 'android' && show ? (
        <DateTimePicker
          value={keyToDate(value && value >= minKey ? value : minKey)}
          mode="date"
          display="calendar"
          minimumDate={minDate}
          onChange={onNativeChange}
        />
      ) : null}

      {Platform.OS === 'ios' && show ? (
        <Modal transparent animationType="slide" visible={show} onRequestClose={() => setShow(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.iosSheet, { backgroundColor: theme.colors.elevation.level3 }]}>
              <Text variant="titleMedium" style={styles.sheetTitle}>
                {label}
              </Text>
              <DateTimePicker
                value={keyToDate(value && value >= minKey ? value : minKey)}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                onChange={onNativeChange}
                themeVariant={theme.dark ? 'dark' : 'light'}
              />
              <Button mode="contained" onPress={() => setShow(false)}>
                Done
              </Button>
            </View>
          </View>
        </Modal>
      ) : null}

      {Platform.OS === 'web' && show ? (
        <Modal transparent animationType="fade" visible={show} onRequestClose={() => setShow(false)}>
          <Pressable style={styles.backdropCentered} onPress={() => setShow(false)}>
            <Pressable onPress={(e) => e.stopPropagation()}>{calendarBody}</Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  label: { marginBottom: 8 },
  trigger: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  triggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  triggerText: {
    flex: 1,
    gap: 2,
  },
  clear: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 24, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropCentered: {
    flex: 1,
    backgroundColor: 'rgba(7, 16, 24, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  heroLabel: {
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
    marginBottom: 4,
  },
  heroDate: {
    fontWeight: '700',
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
  },
  monthNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontWeight: '700',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarFrame: {
    width: CALENDAR_WIDTH,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: GRID_GAP,
  },
  weekCell: {
    width: DAY_SIZE,
    alignItems: 'center',
  },
  weekLabel: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  daySlot: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubble: {
    width: DAY_SIZE - 2,
    height: DAY_SIZE - 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'flex-start',
    width: '100%',
  },
  quickRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  done: {
    marginTop: 16,
    width: '100%',
    borderRadius: 14,
  },
  doneContent: {
    height: 46,
  },
  iosSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    marginBottom: 4,
  },
});
