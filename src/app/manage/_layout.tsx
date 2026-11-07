import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function SettingsLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text },
        contentStyle: { backgroundColor: c.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );
}
