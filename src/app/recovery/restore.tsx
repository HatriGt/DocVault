import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Screen, T } from '../../components/ui';
import { space, type, useTheme } from '../../theme';
import { getPendingAccount } from '../../lib/pending';
import { lookupExistingVault, resetRemoteVault, restoreFromRecoveryKey } from '../../lib/vault';
import { registerBackgroundSync } from '../../lib/backgroundSync';

export default function Restore() {
  const { c } = useTheme();
  const account = getPendingAccount();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    router.replace('/onboarding');
    return null;
  }

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const kf = await lookupExistingVault();
      if (!kf) throw new Error('No vault was found in this Google account.');
      await restoreFromRecoveryKey(account, kf, key);
      registerBackgroundSync();
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const lost = () =>
    Alert.alert(
      'Start a new vault?',
      'Without your recovery key, your existing encrypted documents can’t be decrypted by anyone. Starting over permanently deletes them from your Google Drive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & start over',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await resetRemoteVault();
              router.replace('/recovery/setup');
            } catch (e) {
              Alert.alert('Couldn’t reset', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.xxl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="cloud-download" size={28} color={c.accent} />
          </View>
          <T v="title" style={{ marginTop: space.xl }}>
            Welcome back{account.profile ? `, ${account.profile.name.split(' ')[0]}` : ''}
          </T>
          <T v="body" color="muted" style={{ marginTop: space.md, marginBottom: space.xxl }}>
            We found your encrypted vault in Google Drive. Enter your recovery key to unlock it on this device.
          </T>
          <Field
            label="Recovery key"
            value={key}
            onChangeText={setKey}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            style={[type.mono, { fontSize: 14 }]}
          />
          {error && (
            <T v="callout" color="danger" style={{ marginTop: space.md }}>
              {error}
            </T>
          )}
          <View style={{ flex: 1 }} />
          <Button title="Unlock vault" onPress={restore} loading={busy} disabled={key.replace(/[^0-9a-z]/gi, '').length < 32} style={{ marginTop: space.xxl }} />
          <Button title="I lost my recovery key" variant="ghost" onPress={lost} style={{ marginTop: space.sm }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
