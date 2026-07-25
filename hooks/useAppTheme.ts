import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  MD3DarkTheme,
  MD3LightTheme,
  adaptNavigationTheme,
  configureFonts,
} from 'react-native-paper';
import { DarkTheme as NavDark, DefaultTheme as NavLight } from '@react-navigation/native';
import { useSettingsStore } from '../features/settings/settingsStore';
import { BRAND } from '../constants/theme';

const fontConfig = configureFonts({ config: { fontFamily: 'System' } });

const lightTheme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND.primary,
    primaryContainer: BRAND.primaryContainer,
    secondary: BRAND.secondary,
    background: BRAND.surface,
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  fonts: fontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#BFC2FF',
    primaryContainer: '#3A3F8F',
    secondary: '#4DD8E8',
    background: BRAND.surfaceDark,
  },
};

export function useAppTheme() {
  const system = useColorScheme();
  const themeMode = useSettingsStore((s) => s.settings?.theme ?? 'system');
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && system === 'dark');

  const paperTheme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavLight,
    reactNavigationDark: NavDark,
    materialLight: lightTheme,
    materialDark: darkTheme,
  });

  const navigationTheme = isDark ? DarkTheme : LightTheme;

  return { paperTheme, navigationTheme, isDark };
}
