import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { IconButton } from 'react-native-paper';
import { DashboardScreen } from '../screens/main/DashboardScreen';
import { HabitsScreen } from '../screens/main/HabitsScreen';
import { GoalsScreen } from '../screens/main/GoalsScreen';
import { ReportsScreen } from '../screens/main/ReportsScreen';
import { MainTabParamList } from './types';
import { useTheme } from 'react-native-paper';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: { backgroundColor: theme.colors.elevation.level2 },
        headerRight: () => (
          <IconButton
            icon="cog"
            onPress={() => navigation.getParent()?.navigate('Settings' as never)}
          />
        ),
        tabBarActiveTintColor: theme.colors.primary,
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
