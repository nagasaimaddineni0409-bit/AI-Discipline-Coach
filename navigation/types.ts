export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Habits: { editHabitId?: string } | undefined;
  Goals: undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
  Privacy: undefined;
  Admin: undefined;
};
