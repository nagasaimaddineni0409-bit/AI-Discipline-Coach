import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { HabitsScreen } from '../screens/main/HabitsScreen';
import { GoalsScreen } from '../screens/main/GoalsScreen';
import { ReportsScreen } from '../screens/main/ReportsScreen';
import { MainTabParamList } from './types';
import { useTheme } from 'react-native-paper';
import { AUTH } from '../constants/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const theme = useTheme();
  const isDark = theme.dark;
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: {
          backgroundColor: isDark ? AUTH.ink : theme.colors.elevation.level2,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? AUTH.panelBorder : theme.colors.outline,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: isDark ? AUTH.cream : theme.colors.onSurface,
        },
        headerTintColor: isDark ? AUTH.cream : theme.colors.onSurface,
        headerRight: () => (
          <IconButton
            icon="cog"
            iconColor={isDark ? AUTH.mist : theme.colors.onSurfaceVariant}
            onPress={() => navigation.getParent()?.navigate('Settings' as never)}
          />
        ),
        tabBarStyle: {
          backgroundColor: isDark ? AUTH.panelSolid : theme.colors.elevation.level2,
          borderTopColor: isDark ? AUTH.panelBorder : theme.colors.outline,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: isDark ? AUTH.tealSoft : theme.colors.primary,
        tabBarInactiveTintColor: isDark ? AUTH.mist : theme.colors.onSurfaceVariant,
        tabBarIcon: ({ color, size }) => {
          const map: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> =
            {
              Dashboard: 'view-dashboard',
              Habits: 'repeat',
              Goals: 'flag-checkered',
              Reports: 'chart-timeline-variant',
            };
          return <MaterialCommunityIcons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
    </Tab.Navigator>
  );
}
