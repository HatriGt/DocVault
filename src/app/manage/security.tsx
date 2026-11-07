import React, { useEffect, useState } from 'react';
import { ScrollView, Switch } from 'react-native';
import { router, Stack } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Group, Row, T } from '../../components/ui';
import { space, useTheme } from '../../theme';
import { usePrefs } from '../../lib/hooks';
import { setPrefs } from '../../lib/session';
import { clearPin, hasPin } from '../../lib/keys';

const TIMEOUTS = [0, 30, 60, 300, 900];
const label = (s: number) => (s === 0 ? 'Immediately' : s < 60 ? `${s} seconds` : `${s / 60} minute${s > 60 ? 's' : ''}`);

export default function Security() {
  const { c } = useTheme();
  const prefs = usePrefs();
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      setBioLabel(
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
          ? 'Face unlock'
          : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
            ? 'Fingerprint'
            : 'Biometrics',
      );
      setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
    })();
  }, []);

  const toggleBio = async (v: boolean) => {
    if (v) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: `Enable ${bioLabel}` });
      if (!r.success) return;
    }
    setPrefs({ biometricLock: v });
  };

  const togglePin = async (v: boolean) => {
    if (v) router.push('/manage/pin');
    else {
      await clearPin();
      setPrefs({ pinLock: false });
    }
  };

  const cycleTimeout = () => {
    const i = TIMEOUTS.indexOf(prefs.lockAfterSeconds);
    setPrefs({ lockAfterSeconds: TIMEOUTS[(i + 1) % TIMEOUTS.length] });
  };

  useEffect(() => {
    // keep pref in sync if PIN was removed elsewhere
    hasPin().then((h) => {
      if (!h && prefs.pinLock) setPrefs({ pinLock: false });
    });
  }, [prefs.pinLock]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl }}>
      <Stack.Screen options={{ title: 'App lock' }} />
      <Group title="Unlock with" footer="App lock protects your vault if someone else picks up your unlocked phone. Content is also hidden in the app switcher.">
        <Row
          icon="finger-print"
          title={bioLabel}
          subtitle={bioAvailable ? undefined : 'Set up biometrics in your device settings'}
          right={<Switch value={prefs.biometricLock} disabled={!bioAvailable} onValueChange={toggleBio} trackColor={{ true: c.accent }} />}
        />
        <Row icon="keypad-outline" title="6-digit PIN" right={<Switch value={prefs.pinLock} onValueChange={togglePin} trackColor={{ true: c.accent }} />} />
        {prefs.pinLock && <Row icon="refresh-outline" title="Change PIN" onPress={() => router.push('/manage/pin')} />}
      </Group>
      {(prefs.biometricLock || prefs.pinLock) && (
        <Group title="Auto-lock">
          <Row icon="timer-outline" title="Lock after leaving the app" value={label(prefs.lockAfterSeconds)} onPress={cycleTimeout} />
        </Group>
      )}
      <T v="caption" color="faint" style={{ marginHorizontal: space.xs }}>
        Your vault key is stored in the {`iOS Keychain / Android Keystore`} and is bound to this device. It never syncs to iCloud or Google backups.
      </T>
    </ScrollView>
  );
}

