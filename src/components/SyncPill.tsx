import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { T, Tap } from './ui';
import { radius, space, useTheme } from '../theme';
import { useAccount, useDocuments, useSyncStatus } from '../lib/hooks';
import { relativeTime } from '../lib/format';

/** Compact security + sync indicator for the home header. */
export function SyncPill() {
  const { c } = useTheme();
  const s = useSyncStatus();
  const { account } = useAccount();
  const { docs } = useDocuments();
  const pending = docs.filter((d) => d.sync_state === 'upload_pending' || d.sync_state === 'download_pending').length;
  const failed = docs.filter((d) => d.sync_state === 'failed').length;

  let icon: keyof typeof Ionicons.glyphMap = 'shield-checkmark';
  let tone = c.success;
  let label = 'Encrypted · Synced';
  if (account?.mode === 'local') label = 'Encrypted · On device';
  else if (s.running) label = s.progress ? `Syncing ${s.progress.done}/${s.progress.total}` : 'Syncing…';
  else if (failed) {
    icon = 'alert-circle';
    tone = c.danger;
    label = `${failed} failed to sync`;
  } else if (!s.online) {
    icon = 'cloud-offline';
    tone = c.textMuted;
    label = pending ? `Offline · ${pending} pending` : 'Offline · All available';
  } else if (pending) {
    icon = 'cloud-upload';
    tone = c.warning;
    label = `${pending} pending`;
  }
  else if (s.lastSyncAt) label = `Synced ${relativeTime(s.lastSyncAt).toLowerCase()}`;

  return (
    <Tap
      onPress={() => router.push('/manage/sync')}
      accessibilityLabel={`Security status: ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: c.surface,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        height: 30,
      }}
    >
      {s.running ? <ActivityIndicator size="small" color={c.accent} /> : <Ionicons name={icon} size={15} color={tone} />}
      <T v="caption" color="muted">
        {label}
      </T>
      <View />
    </Tap>
  );
}
