import React, { useMemo } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { Group, Row, T } from '../../components/ui';
import { DocThumb } from '../../components/docs';
import { radius, space, useTheme } from '../../theme';
import { useAccount, useDocuments, usePrefs } from '../../lib/hooks';
import { formatBytes } from '../../lib/format';
import { setPrefs } from '../../lib/session';
import { OfflineChangeError, setOfflinePreference } from '../../lib/documents';
import { localVaultBytes } from '../../lib/blobs';

export default function Storage() {
  const { c } = useTheme();
  const { docs } = useDocuments();
  const prefs = usePrefs();
  const { account } = useAccount();
  const google = account?.mode === 'google';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const used = useMemo(() => localVaultBytes(), [docs]);
  const total = docs.reduce((s, d) => s + d.size, 0);

  const toggle = async (id: string, keep: boolean) => {
    const d = docs.find((x) => x.id === id)!;
    try {
      await setOfflinePreference(d, keep ? 'keep' : 'cloud');
    } catch (e) {
      Alert.alert(e instanceof OfflineChangeError ? 'Not yet' : 'Error', e instanceof Error ? e.message : String(e));
    }
  };

  const keepAll = () =>
    Promise.all(docs.filter((d) => d.offline_pref !== 'keep').map((d) => setOfflinePreference(d, 'keep'))).then(() => setPrefs({ offlineDefault: 'keep' }));

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: 'Offline storage' }} />
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, marginBottom: space.xxl }}>
        <T v="overline" color="faint">
          ON THIS DEVICE
        </T>
        <T v="display" style={{ marginTop: space.xs }}>
          {formatBytes(used)}
        </T>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, marginTop: space.md, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${total ? Math.min(100, (used / total) * 100) : 0}%`, backgroundColor: c.accent }} />
        </View>
        <T v="caption" color="muted" style={{ marginTop: space.sm }}>
          {docs.filter((d) => d.has_local).length} of {docs.length} documents available offline · all encrypted
        </T>
      </View>

      {google && (
        <Group title="New documents" footer="Documents are never removed from this device automatically. Cloud-only documents download when you open them.">
          <Row icon="cloud-done-outline" title="Keep all documents offline" onPress={keepAll} right={prefs.offlineDefault === 'keep' ? <T v="callout" color="accent">✓</T> : undefined} chevron={false} />
          <Row
            icon="cloud-outline"
            title="Choose per document"
            subtitle="New documents are cloud-only by default"
            onPress={() => setPrefs({ offlineDefault: 'cloud' })}
            right={prefs.offlineDefault === 'cloud' ? <T v="callout" color="accent">✓</T> : undefined}
            chevron={false}
          />
        </Group>
      )}

      {google && (
        <Group title="Documents">
          {docs.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <DocThumb doc={d} size={40} />
              <View style={{ flex: 1 }}>
                <T v="body" numberOfLines={1}>
                  {d.name}
                </T>
                <T v="caption" color="muted">
                  {formatBytes(d.size)} · {d.has_local ? 'On device' : 'Cloud only'}
                </T>
              </View>
              <Switch value={d.offline_pref === 'keep'} onValueChange={(v) => toggle(d.id, v)} trackColor={{ true: c.accent }} accessibilityLabel={`Keep ${d.name} offline`} />
            </View>
          ))}
        </Group>
      )}
    </ScrollView>
  );
}
