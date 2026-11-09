import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { TabSwipe } from '../../components/TabSwipe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group, Row, Screen, T } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';
import { useAccount, useDocuments, usePrefs, useSyncStatus } from '../../lib/hooks';
import { relativeTime } from '../../lib/format';
import { setPrefs } from '../../lib/session';
import { signOutAndWipeDevice } from '../../lib/vault';
import { notifyError, confirm } from '../../lib/feedback';

export default function Settings() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const { docs } = useDocuments();
  const prefs = usePrefs();
  const sync = useSyncStatus();

  const signOut = async () => {
    const google = account?.mode === 'google';
    const ok = await confirm({
      title: google ? 'Sign out and remove from this device?' : 'Delete this vault?',
      message: google
        ? 'All documents and keys will be erased from this phone. Your encrypted vault stays in Google Drive — you’ll need your recovery key to restore it.'
        : 'This vault exists only on this device. Everything will be permanently deleted.',
      confirmLabel: google ? 'Sign out' : 'Delete everything',
      destructive: true,
    });
    if (!ok) return;
    try {
      await signOutAndWipeDevice();
      router.replace('/onboarding');
    } catch (e) {
      notifyError(e, google ? 'Couldn’t sign out' : 'Couldn’t delete the vault');
    }
  };

  const cycleTheme = () => setPrefs({ theme: prefs.theme === 'system' ? 'light' : prefs.theme === 'light' ? 'dark' : 'system' });

  return (
    <TabSwipe>
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + 140 }}>
        <T v="title" style={{ marginBottom: space.xl }}>
          You
        </T>

        {/* Account card */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: c.hero, borderRadius: radius.xl, padding: space.xl, marginBottom: space.xxl }}>
          {account?.profile?.picture ? (
            <Image source={{ uri: account.profile.picture }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <T v="heading" color="#FFFFFF">
                {(account?.displayName?.[0] ?? 'D').toUpperCase()}
              </T>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <T v="bodyStrong" color={c.heroText}>
              {account?.profile?.name ?? account?.displayName}
            </T>
            <T v="caption" color={c.heroMuted}>
              {account?.mode === 'google' ? account.profile?.email : 'On-device vault · not backed up'}
            </T>
          </View>
        </View>

        <Group title="Backup">
          {account?.mode === 'google' ? (
            <>
              <Row icon="logo-google" title="Google Drive" subtitle="Encrypted backup in a private app folder" value="Connected" />
              <Row
                icon="sync-outline"
                title="Sync status"
                value={sync.running ? 'Syncing…' : relativeTime(sync.lastSyncAt)}
                onPress={() => router.push('/manage/sync')}
              />
              <Row icon="cloud-download-outline" title="Offline storage" subtitle="Choose what stays on this phone" value={`${docs.filter((d) => d.has_local).length} of ${docs.length}`} onPress={() => router.push('/manage/storage')} />
            </>
          ) : (
            <Row icon="cloud-upload-outline" title="Back up to Google Drive" subtitle="Not backed up — a lost phone means lost documents" onPress={() => router.push('/manage/connect')} />
          )}
        </Group>

        <Group title="Your vault">
          <Row icon="calendar-outline" title="Renewals" subtitle="Expiry timeline and reminders" onPress={() => router.push('/renewals')} />
          <Row icon="pie-chart-outline" title="Insights" subtitle="Storage, formats and coverage" onPress={() => router.push('/manage/insights')} />
          <Row icon="pricetags-outline" title="Categories" onPress={() => router.push('/manage/categories')} />
          <Row icon="trash-outline" title="Recently deleted" subtitle="Restore within 30 days" onPress={() => router.push('/trash')} />
        </Group>

        <Group title="Security">
          <Row icon="finger-print" title="App lock" value={prefs.biometricLock ? 'Biometrics' : prefs.pinLock ? 'PIN' : 'Off'} onPress={() => router.push('/manage/security')} />
          <Row icon="key-outline" title="Recovery key" subtitle="Restore your vault on a new device" onPress={() => router.push('/manage/recovery')} />
          <Row icon="shield-checkmark-outline" title="Encryption" value="AES-256-GCM" onPress={() => router.push('/manage/privacy')} />
        </Group>

        <Group title="Preferences">
          <Row icon="notifications-outline" title="Expiry reminders" value={prefs.expiryReminders ? 'On' : 'Off'} onPress={() => setPrefs({ expiryReminders: !prefs.expiryReminders })} />
          <Row icon="contrast-outline" title="Appearance" value={{ system: 'System', light: 'Light', dark: 'Dark' }[prefs.theme]} onPress={cycleTheme} />
        </Group>

        <Group title="About">
          <Row icon="lock-closed-outline" title="Privacy & security" onPress={() => router.push('/manage/privacy')} />
          <Row icon="information-circle-outline" title="Version" value="1.0.0" />
        </Group>

        <Group>
          <Row icon="log-out-outline" title={account?.mode === 'google' ? 'Sign out & remove from device' : 'Delete vault'} danger onPress={signOut} chevron={false} />
        </Group>
      </ScrollView>
    </Screen>
    </TabSwipe>
  );
}
