import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { Banner, Button, Group, Row, T } from '../../components/ui';
import { DocRow } from '../../components/docs';
import { space, useTheme } from '../../theme';
import { useAccount, useDocuments, usePrefs, useSyncStatus } from '../../lib/hooks';
import { relativeTime } from '../../lib/format';
import { retryFailed, syncNow } from '../../lib/sync';
import { setPrefs } from '../../lib/session';

export default function SyncScreen() {
  const { c } = useTheme();
  const s = useSyncStatus();
  const prefs = usePrefs();
  const { account } = useAccount();
  const { docs } = useDocuments();
  const failed = docs.filter((d) => d.sync_state === 'failed');
  const pending = docs.filter((d) => ['upload_pending', 'download_pending', 'syncing'].includes(d.sync_state));
  const counts = {
    synced: docs.filter((d) => d.sync_state === 'synced').length,
    offline: docs.filter((d) => d.has_local).length,
  };
  const google = account?.mode === 'google';

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: 'Sync' }} />
      {!google && <Banner tone="info" icon="cloud-offline-outline" text="Your vault is on this device only. Connect Google Drive in Settings to back up and sync." />}
      {google && s.lastError && <Banner tone="warning" icon="alert-circle-outline" text={s.lastError} />}
      {google && (
        <View style={{ marginVertical: space.xl, gap: space.xs }}>
          <T v="display">{s.running ? 'Syncing…' : failed.length ? 'Needs attention' : pending.length ? 'Waiting' : 'Up to date'}</T>
          <T v="callout" color="muted">
            Last synced {relativeTime(s.lastSyncAt).toLowerCase()} · {s.online ? 'Online' : 'No internet'}
          </T>
          <Button title="Sync now" icon="sync" onPress={() => syncNow()} loading={s.running} disabled={!s.online} style={{ marginTop: space.lg }} />
        </View>
      )}

      <Group title="Overview">
        <Row icon="checkmark-circle-outline" title="Synced" value={String(counts.synced)} />
        <Row icon="phone-portrait-outline" title="Available offline" value={String(counts.offline)} />
        <Row icon="time-outline" title="Pending" value={String(pending.length)} />
        <Row icon="alert-circle-outline" title="Failed" value={String(failed.length)} />
      </Group>

      {google && (
        <Group title="Preferences" footer="Background sync runs when your phone allows it, typically every 30 minutes or more.">
          <Row icon="repeat-outline" title="Automatic sync" right={<Switch value={prefs.autoSync} onValueChange={(v) => setPrefs({ autoSync: v })} trackColor={{ true: c.accent }} />} />
          <Row icon="wifi-outline" title="Sync on Wi-Fi only" right={<Switch value={prefs.wifiOnly} onValueChange={(v) => setPrefs({ wifiOnly: v })} trackColor={{ true: c.accent }} />} />
        </Group>
      )}

      {failed.length > 0 && (
        <View style={{ marginBottom: space.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm }}>
            <T v="heading">Failed</T>
            <Button title="Retry all" size="md" variant="secondary" onPress={() => retryFailed(failed)} />
          </View>
          {failed.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </View>
      )}
      {pending.length > 0 && (
        <View>
          <T v="heading" style={{ marginBottom: space.sm }}>
            In progress
          </T>
          {pending.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
