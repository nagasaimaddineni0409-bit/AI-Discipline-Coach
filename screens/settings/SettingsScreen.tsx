import React, { useEffect, useState } from 'react';
import { Pressable, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Dialog,
  Icon,
  Portal,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../features/auth/authStore';
import { useSettingsStore } from '../../features/settings/settingsStore';
import { logoutUser, deleteAuthUser } from '../../firebase/auth';
import { cacheClearAll } from '../../services/cacheService';
import { DEFAULT_FEATURE_FLAGS } from '../../constants/featureFlags';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { AppCard } from '../../components/AppCard';
import { useBrandPalette } from '../../hooks/useBrandPalette';
import { formatAuthError } from '../../utils/errors';
import {
  ensureAlarmPermissions,
  openExactAlarmSettings,
} from '../../services/alarmPermissions';
import type { ThemeMode } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; icon: string }> = [
  { id: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { id: 'dark', label: 'Dark', icon: 'moon-waning-crescent' },
  { id: 'system', label: 'System', icon: 'laptop' },
];

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const palette = useBrandPalette();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setUser = useAuthStore((s) => s.setUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const { settings, load, setTheme, patch } = useSettingsStore();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  async function onTheme(next: ThemeMode) {
    if (!user) return;
    await setTheme(user.uid, next);
  }

  async function exportData() {
    setSnack('Export is queued. You will get a download when premium export is enabled.');
  }

  async function confirmDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      // Deleting the auth account fires the purgeUserData Cloud Function, which
      // recursively removes this user's Firestore data. We only clear the local
      // cache and session once Firebase confirms the account is gone.
      await deleteAuthUser();
      await cacheClearAll();
      setUser(null);
      setProfile(null);
      setDeleteOpen(false);
    } catch (e) {
      setSnack(formatAuthError(e, 'Could not delete account. Sign in again and retry.'));
    } finally {
      setDeleting(false);
    }
  }

  async function onSignOut() {
    try {
      await logoutUser();
      setUser(null);
      setProfile(null);
    } catch (e) {
      setSnack(formatAuthError(e, 'Could not sign out.'));
    }
  }

  const activeTheme = settings?.theme ?? 'system';
  const danger = theme.dark ? '#FCA5A5' : '#B3261E';
  const onDanger = theme.dark ? '#1A0505' : '#FFFFFF';

  return (
    <ScreenScaffold>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={styles.pageTitle}>
          Settings
        </Text>
        <Text variant="bodyMedium" style={[styles.pageSubtitle, { color: palette.textMuted }]}>
          Appearance, reminders, and account
        </Text>

        <AppCard>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Appearance
          </Text>
          <Text variant="bodySmall" style={[styles.cardHint, { color: palette.textMuted }]}>
            Choose how Discipline AI looks on this device
          </Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const selected = activeTheme === opt.id;
              return (
                <Button
                  key={opt.id}
                  mode={selected ? 'contained' : 'outlined'}
                  icon={opt.icon}
                  onPress={() => onTheme(opt.id)}
                  style={[
                    styles.themeChip,
                    { borderColor: selected ? palette.accent : palette.cardBorder },
                  ]}
                  buttonColor={selected ? palette.accent : undefined}
                  textColor={selected ? palette.onAccent : theme.colors.onSurface}
                  contentStyle={styles.themeChipContent}
                  compact
                >
                  {opt.label}
                </Button>
              );
            })}
          </View>
        </AppCard>

        <AppCard>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Notifications
          </Text>
          <SettingToggle
            title="Enable notifications"
            subtitle="Reminders and discipline nudges"
            value={settings?.notificationsEnabled ?? true}
            onValueChange={(notificationsEnabled) => {
              if (user) void patch(user.uid, { notificationsEnabled });
            }}
          />
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          <SettingToggle
            title="Reminder sounds"
            subtitle="Play a tone when a reminder fires"
            value={settings?.reminderSoundsEnabled ?? true}
            onValueChange={(reminderSoundsEnabled) => {
              if (user) void patch(user.uid, { reminderSoundsEnabled });
            }}
          />
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          <SettingRow
            title="Allow notifications"
            subtitle="Required for reminders to appear"
            icon="bell-ring-outline"
            onPress={() => void ensureAlarmPermissions()}
          />
          {Platform.OS === 'android' ? (
            <>
              <View style={[styles.divider, { backgroundColor: palette.divider }]} />
              <SettingRow
                title="Alarms & reminders"
                subtitle="Exact timed alarms when the app is closed"
                icon="alarm"
                onPress={() => void openExactAlarmSettings()}
              />
            </>
          ) : null}
        </AppCard>

        <AppCard>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Account
          </Text>
          <SettingRow
            title="Profile"
            subtitle={profile?.email ?? 'Manage your display name'}
            icon="account-circle-outline"
            onPress={() => navigation.navigate('Profile')}
          />
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          <SettingRow
            title="Privacy"
            subtitle="How we use your behaviour data"
            icon="shield-lock-outline"
            onPress={() => navigation.navigate('Privacy')}
          />
          <View style={[styles.divider, { backgroundColor: palette.divider }]} />
          <SettingRow
            title="Export data"
            subtitle="Request a copy of your records"
            icon="download-outline"
            onPress={exportData}
          />
        </AppCard>

        <AppCard>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Session
          </Text>
          <Button
            mode="outlined"
            icon="logout"
            onPress={onSignOut}
            style={[styles.actionBtn, { borderColor: palette.cardBorder }]}
            textColor={theme.colors.onSurface}
            contentStyle={styles.actionBtnContent}
          >
            Sign out
          </Button>
          <Button
            mode="contained"
            icon="delete-forever"
            onPress={() => setDeleteOpen(true)}
            style={styles.actionBtn}
            buttonColor={danger}
            textColor={onDanger}
            contentStyle={styles.actionBtnContent}
          >
            Delete account
          </Button>
        </AppCard>

        {profile?.isAdmin && DEFAULT_FEATURE_FLAGS.adminPanel ? (
          <AppCard>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Admin
            </Text>
            <Button
              mode="contained"
              icon="shield-crown"
              onPress={() => navigation.navigate('Admin')}
              buttonColor={palette.accent}
              textColor={palette.onAccent}
              contentStyle={styles.actionBtnContent}
            >
              Open admin panel
            </Button>
          </AppCard>
        ) : null}
      </ScrollView>

      <Portal>
        <Dialog
          visible={deleteOpen}
          onDismiss={() => {
            if (!deleting) setDeleteOpen(false);
          }}
          style={[styles.dialog, { backgroundColor: theme.colors.elevation.level3 }]}
        >
          <Dialog.Icon icon="alert-circle" color={danger} />
          <Dialog.Title>Delete account?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This permanently removes your account and local cache. Habits, goals, and history tied
              to this login will no longer be available.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              textColor={danger}
              loading={deleting}
              disabled={deleting}
              onPress={confirmDeleteAccount}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={Boolean(snack)}
        onDismiss={() => setSnack(null)}
        duration={4500}
        action={{ label: 'OK', onPress: () => setSnack(null) }}
      >
        {snack}
      </Snackbar>
    </ScreenScaffold>
  );
}

function SettingToggle({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const palette = useBrandPalette();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="bodyLarge">{title}</Text>
        <Text variant="bodySmall" style={{ color: palette.textMuted }}>
          {subtitle}
        </Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} color={palette.accent} />
    </View>
  );
}

function SettingRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const palette = useBrandPalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.rowIcon,
          {
            backgroundColor: theme.dark ? 'rgba(45,212,191,0.12)' : 'rgba(15,118,110,0.1)',
          },
        ]}
      >
        <Icon source={icon} size={20} color={palette.accentText} />
      </View>
      <View style={styles.rowText}>
        <Text variant="bodyLarge">{title}</Text>
        <Text variant="bodySmall" style={{ color: palette.textMuted }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon source="chevron-right" size={22} color={palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 48,
    gap: 4,
  },
  pageTitle: {
    fontWeight: '700',
  },
  pageSubtitle: {
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  cardHint: {
    marginBottom: 14,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    borderRadius: 14,
    flexGrow: 1,
  },
  themeChipContent: {
    height: 42,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
  },
  actionBtn: {
    marginTop: 8,
    borderRadius: 14,
  },
  actionBtnContent: {
    height: 46,
  },
  dialog: {
    borderRadius: 20,
  },
});
