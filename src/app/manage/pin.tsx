import React, { useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { T, Tap } from '../../components/ui';
import { space, useTheme } from '../../theme';
import { setPin } from '../../lib/keys';
import { setPrefs } from '../../lib/session';

export default function PinSetup() {
  const { c } = useTheme();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const press = async (d: string) => {
    Haptics.selectionAsync().catch(() => {});
    const next = (pin + d).slice(0, 6);
    setPinValue(next);
    if (next.length < 6) return;
    if (!first) {
      setFirst(next);
      setPinValue('');
      setError(null);
    } else if (first === next) {
      await setPin(next);
      await setPrefs({ pinLock: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError('PINs didn’t match. Try again.');
      setFirst(null);
      setPinValue('');
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', paddingTop: space.xxxl }}>
      <Stack.Screen options={{ title: 'Set PIN' }} />
      <T v="heading">{first ? 'Confirm your PIN' : 'Choose a 6-digit PIN'}</T>
      <T v="callout" color={error ? 'danger' : 'muted'} style={{ marginTop: space.sm, height: 20 }}>
        {error ?? 'Used when biometrics aren’t available'}
      </T>
      <View style={{ flexDirection: 'row', gap: space.md, marginVertical: space.xxl }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < pin.length ? c.accent : c.surfaceAlt }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 276, gap: space.lg, justifyContent: 'center' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
          <Tap
            key={i}
            disabled={!k}
            accessibilityLabel={k === 'del' ? 'Delete' : k}
            onPress={() => (k === 'del' ? setPinValue(pin.slice(0, -1)) : press(k))}
            style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: k && k !== 'del' ? c.surface : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            {k === 'del' ? <Ionicons name="backspace-outline" size={26} color={c.text} /> : <T v="title">{k}</T>}
          </Tap>
        ))}
      </View>
    </View>
  );
}
