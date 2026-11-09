import React, { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Stack } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Banner, Button, T } from '../../components/ui';
import { radius, space, useTheme, fonts } from '../../theme';
import { newRecoveryKey } from '../../lib/vault';
import { useAccount } from '../../lib/hooks';
import { kvSet } from '../../lib/db';
import { notifyError, confirm } from '../../lib/feedback';

export default function Recovery() {
  const { c } = useTheme();
  const { account } = useAccount();
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createKey = async () => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm it’s you' });
    if (!auth.success) return;
    setBusy(true);
    try {
      setKey(await newRecoveryKey());
      kvSet('recovery.unconfirmed', false);
    } catch (e) {
      notifyError(e, 'Couldn’t create key', { retry: createKey });
    } finally {
      setBusy(false);
    }
  };
  const regenerate = async () => {
    const ok = await confirm({
      title: 'Create a new recovery key?',
      message: 'Your old recovery key will stop working immediately. Make sure to save the new one.',
      confirmLabel: 'Create new key',
    });
    if (ok) await createKey();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      <Stack.Screen options={{ title: 'Recovery key' }} />
      <T v="body" color="muted">
        Your recovery key is the only way to unlock your vault on a new device. DocVault never stores it, so it can’t be shown again — but you can
        replace it with a new one at any time.
      </T>
      {account?.mode === 'local' && (
        <Banner tone="warning" icon="warning-outline" text="Your vault isn’t backed up. A recovery key only helps once Google Drive is connected." />
      )}
      {key ? (
        <>
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' }}>
            {key.split('-').map((g, i) => (
              <View key={i} style={{ width: '22%', alignItems: 'center', paddingVertical: space.sm, backgroundColor: c.surfaceAlt, borderRadius: radius.sm }}>
                <T v="mono" selectable style={{ fontFamily: fonts.bold }}>
                  {g}
                </T>
              </View>
            ))}
          </View>
          <Button title="Save to password manager" icon="share-outline" variant="secondary" onPress={() => Share.share({ message: `DocVault recovery key: ${key}` })} />
          <Banner tone="success" icon="checkmark-circle" text="New key active. Your previous key no longer works." />
        </>
      ) : (
        <Button title="Create a new recovery key" icon="key-outline" onPress={regenerate} loading={busy} />
      )}
    </ScrollView>
  );
}
