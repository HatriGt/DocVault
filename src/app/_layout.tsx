import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme';
import { getDb } from '../lib/db';
import { initSyncStatus, startSyncListeners, syncNow } from '../lib/sync';
// Importing this module also defines the background task at module scope.
import { registerBackgroundSync } from '../lib/backgroundSync';
import { purgeTempPlain } from '../lib/blobs';
import { getAccount } from '../lib/session';
import { AppLock } from '../components/AppLock';

function Navigator() {
  const { c, dark } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
  }, [c.bg]);
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <AppLock>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="viewer/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
      </AppLock>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      await getDb();
      purgeTempPlain(); // never leave decrypted files behind from a previous session
      await initSyncStatus();
      unsub = startSyncListeners();
      setReady(true);
      if ((await getAccount())?.mode === 'google') {
        registerBackgroundSync();
        syncNow();
      }
    })();
    return () => unsub?.();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>{ready ? <Navigator /> : null}</ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
