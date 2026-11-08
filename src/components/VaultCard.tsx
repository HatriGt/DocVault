import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { T, Tap } from './ui';
import { elevation, fonts, radius, space, useTheme } from '../theme';
import { useAccount, useDocuments, useSyncStatus } from '../lib/hooks';
import { formatBytes, relativeTime } from '../lib/format';
import { useCountUp } from './motion';

/** Graphite "metal card" summarising the vault: count, offline, sync, size. */
export function VaultCard() {
  const { c } = useTheme();
  const { docs } = useDocuments();
  const { account } = useAccount();
  const s = useSyncStatus();
  const offline = docs.filter((d) => d.has_local).length;
  const count = useCountUp(docs.length);
  const size = docs.reduce((n, d) => n + d.size, 0);
  const pending = docs.filter((d) => d.sync_state === 'upload_pending' || d.sync_state === 'download_pending').length;
  const syncLabel =
    account?.mode !== 'google' ? 'Phone only' : s.running ? 'Backing up…' : !s.online ? 'No internet' : pending ? `${pending} waiting` : s.lastSyncAt ? relativeTime(s.lastSyncAt) : 'Ready';
  return (
    <Tap onPress={() => router.push('/manage/sync')} scaleTo={0.985} accessibilityLabel={`Vault: ${docs.length} documents, ${syncLabel}`}>
      <LinearGradient
        colors={['#7360FF', '#5B45F2', '#3A2BB8']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: radius.xl, padding: space.xl, gap: space.xl, overflow: 'hidden' }, elevation(c, 3)]}
      >
        {/* brushed-metal sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={{ position: 'absolute', top: -40, left: -60, right: -60, height: 160, transform: [{ rotate: '-12deg' }] }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={15} color="#FFFFFF" />
            </View>
            <T v="overline" color={c.heroMuted}>
              DOCVAULT
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, height: 26, borderRadius: radius.pill }}>
            <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
            <T v="caption" color="#FFFFFF" style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
              AES-256
            </T>
          </View>
        </View>
        <View>
          <View style={{ position: 'absolute', right: 0, top: 6, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <T v="caption" color={c.heroMuted}>
              Sync & storage
            </T>
            <Ionicons name="chevron-forward" size={14} color={c.heroMuted} />
          </View>
          <T v="display" color={c.heroText} style={{ fontSize: 52, lineHeight: 58 }}>
            {count}
          </T>
          <T v="callout" color={c.heroMuted}>
            {docs.length === 1 ? 'document secured' : 'documents secured'}
          </T>
        </View>
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', paddingTop: space.md }}>
          {[
            { k: 'On phone', v: `${offline}/${docs.length}` },
            { k: 'Backup', v: syncLabel },
            { k: 'Size', v: formatBytes(size) },
          ].map((x, i) => (
            <View key={x.k} style={{ flex: 1, paddingLeft: i ? space.md : 0, borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(255,255,255,0.16)' }}>
              <T v="caption" color={c.heroMuted} style={{ fontSize: 11 }}>
                {x.k}
              </T>
              <T v="bodyStrong" color={c.heroText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ marginTop: 2 }}>
                {x.v}
              </T>
            </View>
          ))}
        </View>
      </LinearGradient>
    </Tap>
  );
}
