import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import { RootStackParamList } from './types';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { PrivacyScreen } from '../screens/settings/PrivacyScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  isAuthenticated: boolean;
}

export function RootNavigator({ isAuthenticated }: Props) {
  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={({ navigation }) => ({
              headerShown: false,
              // Settings opened from nested tab header via parent — add gear on Dashboard only in future
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export function SettingsHeaderButton({
  onPress,
}: {
  onPress: () => void;
}) {
  return <IconButton icon="cog" onPress={onPress} />;
}
