import 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { AppProviders } from './app/AppProviders';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'Discipline AI';
}

export default function App() {
  return <AppProviders />;
}
