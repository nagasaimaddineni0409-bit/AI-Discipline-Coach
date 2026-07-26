import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AppState, StyleSheet } from 'react-native';
import { RootNavigator } from '../navigation/RootNavigator';
import { useAuthBootstrap } from '../hooks/useAuthBootstrap';
import { useDataSync } from '../hooks/useDataSync';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuthStore } from '../features/auth/authStore';
import { LoadingState } from '../components/LoadingState';
import { AlarmRingHost } from '../components/AlarmRingHost';
import { registerForPushNotifications } from '../notifications/pushService';
import { startAlarmListeners, ringOverdueAlarms } from '../services/alarmService';
import { useSettingsStore } from '../features/settings/settingsStore';

function AppShell() {
  useAuthBootstrap();
  useDataSync();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    if (!user) return;
    loadSettings(user.uid);
    registerForPushNotifications(user.uid).catch(() => undefined);
    const stop = startAlarmListeners();
    void ringOverdueAlarms(user.uid);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void ringOverdueAlarms(user.uid);
    });

    return () => {
      stop();
      appState.remove();
    };
  }, [user, loadSettings]);

  if (!initialized || loading) {
    return <LoadingState message="Starting Discipline AI…" />;
  }

  return (
    <>
      <RootNavigator isAuthenticated={Boolean(user)} />
      <AlarmRingHost />
    </>
  );
}

export function AppProviders() {
  const { paperTheme, navigationTheme, isDark } = useAppTheme();

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <NavigationContainer
            theme={navigationTheme}
            documentTitle={{
              formatter: () => 'Discipline AI',
            }}
          >
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <AppShell />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
