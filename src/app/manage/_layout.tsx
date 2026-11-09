import { Stack } from 'expo-router';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useTheme } from '../../theme';

export default function SettingsLayout() {
  const { c } = useTheme();
  return (
    <Stack
      screenOptions={{
        // Same header as every other pushed screen; each screen still sets its title via <Stack.Screen options>.
        header: ({ options }) => <ScreenHeader title={typeof options.title === 'string' ? options.title : undefined} safeTop />,
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}
