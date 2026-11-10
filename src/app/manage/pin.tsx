import React, { useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { T } from '../../components/ui';
import { PinDots, PinPad } from '../../components/PinPad';
import { space } from '../../theme';
import { setPin } from '../../lib/keys';
import { setPrefs } from '../../lib/session';

export default function PinSetup() {
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
    <View style={{ flex: 1, alignItems: 'center', paddingTop: space.xl }}>
      <Stack.Screen options={{ title: 'Set PIN' }} />
      <T v="heading">{first ? 'Confirm your PIN' : 'Choose a 6-digit PIN'}</T>
      <T v="callout" color={error ? 'danger' : 'muted'} style={{ marginTop: space.sm, height: 20 }}>
        {error ?? (first ? 'Enter it once more' : 'You’ll enter it to open DocVault')}
      </T>
      <PinDots count={pin.length} style={{ marginVertical: space.xxl }} />
      <PinPad onDigit={press} onDelete={() => setPinValue(pin.slice(0, -1))} />
    </View>
  );
}
