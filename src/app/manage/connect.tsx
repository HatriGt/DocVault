import React, { useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { router, Stack } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Button, T } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';
import { GOOGLE_SCOPES, googleClientIds, isGoogleConfigured } from '../../lib/google';
import { completeGoogleSignIn } from '../../lib/googleSignIn';
import { connectDriveToLocalVault, lookupExistingVault } from '../../lib/vault';
import { registerBackgroundSync } from '../../lib/backgroundSync';
import { useAccount } from '../../lib/hooks';

WebBrowser.maybeCompleteAuthSession();

/** Upgrades an on-device vault to Google Drive backup. */
export default function Connect() {
  const { c } = useTheme();
  const { account } = useAccount();
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [request, , promptAsync] = Google.useAuthRequest({
    ...googleClientIds,
    scopes: GOOGLE_SCOPES,
    selectAccount: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  const connect = async () => {
    if (!isGoogleConfigured()) {
      Alert.alert('Google isn’t configured', 'Add OAuth client IDs to .env — see README.');
      return;
    }
    setBusy(true);
    try {
      const profile = await completeGoogleSignIn(await promptAsync(), request?.clientId ?? '');
      if (!profile) return;
      if (await lookupExistingVault()) {
        Alert.alert(
          'This Google account already has a vault',
          'To use it, sign out on this device and restore it with its recovery key. To keep this vault, connect a different Google account.',
        );
        return;
      }
      const k = await connectDriveToLocalVault({ mode: 'google', profile, displayName: account?.displayName || profile.name.split(' ')[0] });
      registerBackgroundSync();
      setKey(k);
    } catch (e) {
      Alert.alert('Couldn’t connect', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      <Stack.Screen options={{ title: 'Google Drive' }} />
      {key ? (
        <>
          <T v="title">Backed up 🎉</T>
          <T v="body" color="muted">
            Your documents are uploading in the background. Here’s your recovery key — save it now. You’ll need it to restore on a new phone.
          </T>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' }}>
            {key.split('-').map((g, i) => (
              <View key={i} style={{ width: '22%', alignItems: 'center', paddingVertical: space.sm, backgroundColor: c.surfaceAlt, borderRadius: radius.sm }}>
                <T v="mono" selectable style={{ fontWeight: '700' }}>
                  {g}
                </T>
              </View>
            ))}
          </View>
          <Button title="Save to password manager" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: `DocVault recovery key: ${key}` })} />
          <Button title="Done" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <T v="title">Back up to Google Drive</T>
          <T v="body" color="muted">
            Your documents will be encrypted on this phone and stored in a private, hidden folder in your Google Drive. You’ll get a recovery key to
            restore them on any device.
          </T>
          <Button
            title="Continue with Google"
            icon="logo-google"
            loading={busy}
            onPress={connect}
          />
        </>
      )}
    </ScrollView>
  );
}
