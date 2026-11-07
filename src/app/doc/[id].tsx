import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Banner, Button, Group, IconButton, Row, Screen, T, Tap } from '../../components/ui';
import { categoryOf, DocThumb, SyncBadge, WalletCard } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { radius, space, useTheme } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { daysUntil, formatBytes, formatDate, maskNumber, relativeTime } from '../../lib/format';
import { exportCopy, OfflineChangeError, parseFields, setOfflinePreference, toggleFavorite } from '../../lib/documents';
import { confirmDelete, openDoc, shareDoc } from '../../lib/actions';
import { retryFailed } from '../../lib/sync';

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc, loading } = useDocument(id);
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const flip = useSharedValue(0);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden',
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden',
  }));

  if (loading) return <Screen>{null}</Screen>;
  if (!doc) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg }}>
          <T v="heading">Document not found</T>
          <Button title="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const isCard = CARD_TYPES.has(doc.doc_type ?? '');
  const f = parseFields(doc);
  const cat = categoryOf(doc.category);
  const days = daysUntil(doc.expiry);
  const cardW = Math.min(width - space.xl * 2, 380);

  const run = async (kind: 'open' | 'share') => {
    setBusy(kind);
    try {
      await (kind === 'open' ? openDoc(doc) : shareDoc(doc));
    } finally {
      setBusy(null);
    }
  };

  const toggleOffline = async () => {
    try {
      await setOfflinePreference(doc, doc.offline_pref === 'keep' ? 'cloud' : 'keep');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert(e instanceof OfflineChangeError ? 'Not yet' : 'Something went wrong', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingVertical: space.sm }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={doc.favorite ? 'heart' : 'heart-outline'}
            tint={doc.favorite ? c.danger : c.text}
            label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggleFavorite(doc);
            }}
          />
          <IconButton icon="ellipsis-horizontal" label="More actions" onPress={() => setMore(true)} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
          {isCard ? (
            <>
              <Tap
                scaleTo={0.98}
                accessibilityLabel="Flip card"
                onPress={() => flip.set(withTiming(flip.get() > 0.5 ? 0 : 1, { duration: 450 }))}
                style={{ width: cardW, height: cardW / 1.586 }}
              >
                <Animated.View style={[StyleSheet.absoluteFill, front]}>
                  <WalletCard doc={doc} width={cardW} />
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, back]}>
                  <WalletCard doc={doc} width={cardW} side="back" />
                </Animated.View>
              </Tap>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
                <Ionicons name="sync-outline" size={13} color={c.textFaint} />
                <T v="caption" color="faint">
                  Tap card to flip
                </T>
              </View>
            </>
          ) : (
            <Tap onPress={() => run('open')} accessibilityLabel="Open document">
              <DocThumb doc={doc} size={Math.min(width * 0.5, 220)} />
            </Tap>
          )}
        </View>

        <View style={{ paddingHorizontal: space.xl }}>
          <T v="title">{doc.name}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
            <SyncBadge doc={doc} />
            {cat && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, height: 26 }}>
                <Ionicons name={cat.icon as never} size={13} color={c.textMuted} />
                <T v="caption" color="muted">
                  {cat.name}
                </T>
              </View>
            )}
          </View>

          {days != null && days <= 90 && (
            <View style={{ marginTop: space.lg }}>
              <Banner
                tone={days < 0 ? 'danger' : 'warning'}
                icon="time-outline"
                text={days < 0 ? `Expired ${Math.abs(days)} days ago` : days === 0 ? 'Expires today' : `Expires in ${days} days — consider renewing`}
              />
            </View>
          )}
          {doc.sync_state === 'failed' && (
            <View style={{ marginTop: space.lg }}>
              <Banner tone="danger" icon="alert-circle" text={doc.last_error ?? 'Sync failed'} action="Retry" onAction={() => retryFailed([doc])} />
            </View>
          )}

          {/* Primary actions: open & share are always ≤ 2 taps */}
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.xl }}>
            <Button title="Open" icon="eye-outline" onPress={() => run('open')} loading={busy === 'open'} style={{ flex: 1 }} />
            <Button title="Share" icon="share-outline" variant="secondary" onPress={() => run('share')} loading={busy === 'share'} style={{ flex: 1 }} />
          </View>

          <View style={{ marginTop: space.xxl }}>
            <Group title="Details">
              {doc.doc_type ? <Row icon="pricetag-outline" title="Type" value={doc.doc_type} /> : null}
              {f.holder ? <Row icon="person-outline" title="Holder" value={f.holder} /> : null}
              {f.number ? (
                <Row
                  icon="keypad-outline"
                  title="Number"
                  value={revealed ? f.number : maskNumber(f.number)}
                  onPress={() => setRevealed(!revealed)}
                  chevron={false}
                  right={<Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textFaint} />}
                />
              ) : null}
              {f.issuer ? <Row icon="business-outline" title="Issued by" value={f.issuer} /> : null}
              {f.country ? <Row icon="flag-outline" title="Country" value={f.country} /> : null}
              <Row icon="calendar-outline" title="Expiry date" value={doc.expiry ? formatDate(doc.expiry) : 'Not set'} />
              <Row icon="add-circle-outline" title="Date added" value={formatDate(doc.created_at)} />
            </Group>

            <Group title="Storage">
              <Row
                icon={doc.offline_pref === 'keep' ? 'cloud-done-outline' : 'cloud-outline'}
                title="Available offline"
                subtitle={doc.offline_pref === 'keep' ? 'Stored encrypted on this device' : 'Downloaded when you open it'}
                value={doc.offline_pref === 'keep' ? 'On' : 'Off'}
                onPress={toggleOffline}
              />
              <Row icon="sync-outline" title="Last synced" value={doc.sync_state === 'local_only' ? 'Device only' : relativeTime(doc.last_synced_at)} />
              <Row icon="document-outline" title="File" value={`${doc.ext.toUpperCase()} · ${formatBytes(doc.size)}`} />
              <Row icon="lock-closed-outline" title="Encryption" value="AES-256-GCM" />
            </Group>

            {doc.notes ? (
              <Group title="Notes">
                <View style={{ padding: space.lg }}>
                  <T v="body">{doc.notes}</T>
                </View>
              </Group>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ActionSheet
        visible={more}
        onClose={() => setMore(false)}
        title={doc.name}
        actions={[
          { label: 'Edit details', icon: 'create-outline', onPress: () => router.push(`/edit/${doc.id}`) },
          {
            label: 'Save a copy',
            icon: 'download-outline',
            onPress: () => exportCopy(doc).catch((e) => Alert.alert('Couldn’t save', String(e?.message ?? e))),
          },
          {
            label: doc.offline_pref === 'keep' ? 'Make cloud-only' : 'Keep offline',
            icon: doc.offline_pref === 'keep' ? 'cloud-outline' : 'cloud-download-outline',
            onPress: toggleOffline,
          },
          { label: 'Delete document', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(doc, () => router.back()) },
        ]}
      />
    </Screen>
  );
}
