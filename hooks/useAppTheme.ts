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
import { AUTH } from '../constants/theme';

const fontConfig = configureFonts({ config: { fontFamily: 'System' } });

const lightTheme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    // Deeper teal than the brand mark so white label text stays readable.
    primary: '#0F766E',
    onPrimary: '#FFFFFF',
    primaryContainer: '#CCFBF1',
    onPrimaryContainer: '#042F2E',
    secondary: '#475569',
    background: '#F4F7F6',
    surface: '#FFFFFF',
    surfaceVariant: '#E2EEEC',
    onSurface: '#0B1C24',
    onSurfaceVariant: '#4A6360',
    outline: '#B7CBC7',
    outlineVariant: '#CFE0DC',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#FFFFFF',
      level2: '#F0F6F4',
      level3: '#E7F1EF',
    },
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  fonts: fontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: AUTH.tealSoft,
    primaryContainer: AUTH.tealDeep,
    secondary: AUTH.mist,
    background: AUTH.ink,
    surface: AUTH.panelSolid,
    surfaceVariant: AUTH.fieldSolid,
    onSurface: AUTH.cream,
    onSurfaceVariant: AUTH.mist,
    outline: AUTH.panelBorder,
    error: AUTH.danger,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: AUTH.ink,
      level1: AUTH.panelSolid,
      level2: AUTH.panelSolid,
      level3: AUTH.fieldSolid,
    },
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

  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: AUTH.ink,
          card: AUTH.panelSolid,
          primary: AUTH.tealSoft,
          text: AUTH.cream,
          border: AUTH.panelBorder,
          notification: AUTH.teal,
        },
      }
    : LightTheme;

  return { paperTheme, navigationTheme, isDark };
}
