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
import { ToastHost } from '../components/ToastHost';
import { purgeExpiredTrash } from '../lib/documents';
import { purgeScanCache } from '../lib/scan';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

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
          <Stack.Screen name="share" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="expo-sharing" options={{ animation: 'none' }} />
          <Stack.Screen name="move/[id]" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="edit-image/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="present/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="oauthredirect" options={{ animation: 'none', presentation: 'transparentModal' }} />
          <Stack.Screen name="view/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack>
        <ToastHost />
      </AppLock>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      await getDb();
      purgeTempPlain(); // never leave decrypted files behind from a previous session
      purgeExpiredTrash().catch(() => {});
      purgeScanCache();
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
        <ThemeProvider>{ready && (fontsLoaded || fontError) ? <Navigator /> : null}</ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
