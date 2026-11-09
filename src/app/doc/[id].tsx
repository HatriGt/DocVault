import React, { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Banner, Button, Chip, Group, IconButton, Row, Screen, T, Tap } from '../../components/ui';
import { categoryOf, PassportBook, SyncBadge, WalletCard } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { TagPill } from '../../components/Tags';
import { useFolderLabel } from '../../components/Folders';
import { Backdrop } from '../../components/Backdrop';
import { ActivityList } from '../../components/ActivityList';
import { DocPreview } from '../../components/DocPreview';
import { KeyFacts, type KeyFact } from '../../components/KeyFacts';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useAccount, useDocument } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { daysUntil, formatBytes, humanDays, formatDate, maskNumber, relativeTime } from '../../lib/format';
import { isImage, isPdf, parseFields, parseTags, toggleFavorite } from '../../lib/documents';
import { docActions, openDoc, presentDoc, shareDoc, toggleOffline } from '../../lib/actions';
import { unlockDoc } from '../../lib/guard';
import { retryFailed } from '../../lib/sync';

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc, loading } = useDocument(id);
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const flip = useSharedValue(0);
  const folderLabel = useFolderLabel(doc?.folder_id);

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
  const tags = parseTags(doc);
  const cat = categoryOf(doc.category);
  const days = daysUntil(doc.expiry);
  const cardW = Math.min(width - space.xl * 2, 380);
  const revealNumber = async () => (revealed ? setRevealed(false) : (await unlockDoc(doc)) && setRevealed(true));
  const keyFacts: KeyFact[] = [
    ...(doc.expiry && days != null
      ? [{
          label: days < 0 ? 'Expired' : 'Expires',
          value: formatDate(doc.expiry),
          note: humanDays(days),
          tone: (days < 0 ? 'danger' : days <= 90 ? 'warning' : 'default') as KeyFact['tone'],
        }]
      : []),
    ...(f.number
      ? [{
          label: 'Number',
          value: revealed ? f.number : maskNumber(f.number),
          icon: (revealed ? 'eye-off-outline' : 'eye-outline') as KeyFact['icon'],
          onPress: revealNumber,
          accessibilityLabel: revealed ? `Number ${f.number}. Tap to hide` : 'Number hidden. Tap to reveal',
        }]
      : []),
    ...(f.holder ? [{ label: 'Holder', value: f.holder }] : []),
  ].slice(0, 3);

  const run = async (kind: 'open' | 'share') => {
    setBusy(kind);
    try {
      await (kind === 'open' ? openDoc(doc) : shareDoc(doc));
    } finally {
      setBusy(null);
    }
  };


  const glass = c.surface;
  return (
    <Screen edges={[]}>
      <StatusBar style="dark" />
      <View style={{ position: 'absolute', zIndex: 10, top: insets.top + space.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl }}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} bg={glass} tint={c.text} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={doc.favorite ? 'heart' : 'heart-outline'}
            tint={c.danger}
            bg={c.dangerSoft}
            label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              toggleFavorite(doc);
            }}
          />
          <IconButton icon="ellipsis-horizontal" label="More actions" onPress={() => setMore(true)} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={{ alignItems: 'center', paddingTop: insets.top + 64, paddingBottom: space.xl, overflow: 'hidden' }}>
          <Backdrop variant="detail" />
          {doc.doc_type === 'Passport' ? (
            <View style={{ transform: [{ rotate: '-6deg' }], marginVertical: space.sm }}>
              <PassportBook doc={doc} width={Math.min(width * 0.4, 180)} />
            </View>
          ) : isCard ? (
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
            <Tap onPress={() => run('open')} accessibilityLabel="Open document" scaleTo={0.98}>
              <DocPreview doc={doc} width={width} />
            </Tap>
          )}
        </View>

        <View style={{ paddingHorizontal: space.xl }}>
          <T v="title">
            {doc.name}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            {!!doc.locked && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.accentSoft }}>
                <Ionicons name="lock-closed" size={13} color={c.accent} />
                <T v="caption" color="accent" style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                  Locked
                </T>
              </View>
            )}
            {/* Offline/sync status only means something when there's a cloud copy. */}
            {account?.mode !== 'google' ? null : doc.has_local && doc.sync_state !== 'failed' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.successSoft }}>
                <Ionicons name="checkmark-circle" size={15} color={c.success} />
                <T v="caption" color="success" style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                  Available Offline
                </T>
              </View>
            ) : (
              <SyncBadge doc={doc} />
            )}
            {cat && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, height: 26 }}>
                <Ionicons name={cat.icon as never} size={13} color={c.textMuted} />
                <T v="caption" color="muted">
                  {cat.name}
                </T>
              </View>
            )}
          </View>

          {keyFacts.length > 0 && (
            <View style={{ marginTop: space.lg }}>
              <KeyFacts facts={keyFacts} />
            </View>
          )}
          {doc.sync_state === 'failed' && (
            <View style={{ marginTop: space.lg }}>
              <Banner tone="danger" icon="alert-circle" text={doc.last_error ?? 'Sync failed'} action="Retry" onAction={() => retryFailed([doc])} />
            </View>
          )}

          <Tap onPress={() => (doc.folder_id ? router.push(`/folder/${doc.folder_id}`) : router.push(`/move/${doc.id}`))} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md, alignSelf: 'flex-start' }}>
            <Ionicons name={doc.folder_id ? 'folder' : 'folder-open-outline'} size={16} color={c.accent} />
            <T v="callout" color="accent" style={{ fontFamily: fonts.semibold }}>
              {doc.folder_id ? folderLabel : 'Add to a folder'}
            </T>
          </Tap>
          {/* Quick tools */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.lg, marginHorizontal: -space.xl }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}>
            {(isImage(doc)
              ? [
                  { label: 'Edit & crop', icon: 'crop', go: () => router.push({ pathname: '/edit-image/[id]', params: { id: doc.id } }) },
                  { label: 'Convert format', icon: 'swap-horizontal', go: () => router.push({ pathname: '/edit-image/[id]', params: { id: doc.id } }) },
                  { label: 'To PDF', icon: 'document-text', go: () => router.push({ pathname: '/tools/run', params: { tool: 'img2pdf', ids: doc.id } }) },
                ]
              : isPdf(doc)
                ? [
                    { label: 'Rotate', icon: 'refresh-circle', go: () => router.push({ pathname: '/tools/run', params: { tool: 'rotate', ids: doc.id } }) },
                    { label: 'Extract pages', icon: 'albums', go: () => router.push({ pathname: '/tools/run', params: { tool: 'extract', ids: doc.id } }) },
                    { label: 'Split', icon: 'cut', go: () => router.push({ pathname: '/tools/run', params: { tool: 'split', ids: doc.id } }) },
                    { label: 'Merge with…', icon: 'git-merge', go: () => router.push({ pathname: '/tools/run', params: { tool: 'merge', ids: doc.id } }) },
                  ]
                : []
            ).map((t) => (
              <Chip key={t.label} label={t.label} icon={t.icon as never} tint={c.accent} onPress={t.go} />
            ))}
          </ScrollView>
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
              {tags.map((t) => (
                <TagPill key={t} tag={t} />
              ))}
            </View>
          )}

          <View style={[{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: space.lg }, elevation(c, 1)]}>
            {[
              { icon: 'calendar-outline' as const, k: 'Expiry Date', v: doc.expiry ? formatDate(doc.expiry) : 'Not set' },
              {
                icon: 'sync-outline' as const,
                k: 'Last Synced',
                v: doc.sync_state === 'local_only' ? 'This device only' : relativeTime(doc.last_synced_at),
                ok: doc.sync_state === 'synced',
              },
              { icon: 'cloud-outline' as const, k: 'File Size', v: formatBytes(doc.size) },
            ].map((r, i) => (
              <View key={r.k} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, height: 58, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.border }}>
                <Ionicons name={r.icon} size={22} color={c.text} />
                <T v="body" style={{ flex: 1, fontFamily: fonts.medium }}>
                  {r.k}
                </T>
                <T v="body" color="muted" style={{ fontFamily: fonts.medium }}>
                  {r.v}
                </T>
                {r.ok && <Ionicons name="checkmark-circle" size={20} color={c.success} />}
              </View>
            ))}
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
                  onPress={revealNumber}
                  chevron={false}
                  right={<Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textFaint} />}
                />
              ) : null}
              {f.issuer ? <Row icon="business-outline" title="Issued by" value={f.issuer} /> : null}
              {f.country ? <Row icon="flag-outline" title="Country" value={f.country} /> : null}
              <Row icon="add-circle-outline" title="Date added" value={formatDate(doc.created_at)} />
            </Group>

            <Group title="Storage">
              <Row
                icon={doc.offline_pref === 'keep' ? 'cloud-done-outline' : 'cloud-outline'}
                title="Available offline"
                subtitle={doc.offline_pref === 'keep' ? 'Stored encrypted on this device' : 'Downloaded when you open it'}
                value={doc.offline_pref === 'keep' ? 'On' : 'Off'}
                onPress={() => toggleOffline(doc)}
              />
              <Row icon="document-outline" title="File" value={`${doc.ext.toUpperCase()} · ${formatBytes(doc.size)}`} />
              <Row icon="lock-closed-outline" title="Encryption" value="AES-256-GCM" />
            </Group>

            <ActivityList docId={doc.id} />
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

      {/* Sticky action bar: open & share are always one tap from here */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.xl,
          paddingTop: space.lg,
          paddingBottom: insets.bottom + space.lg,
          backgroundColor: c.bg,
        }}
      >
        <BarButton icon="share-outline" label="Share" onPress={() => run('share')} loading={busy === 'share'} />
        <Button title="Open" icon="eye-outline" onPress={() => run('open')} loading={busy === 'open'} style={{ flex: 1, height: 66 }} />
        <BarButton icon="expand-outline" label="Present" onPress={() => presentDoc(doc)} />
      </View>

      <ActionSheet
        visible={more}
        onClose={() => setMore(false)}
        title={doc.name}
        actions={docActions(doc, { cloud: account?.mode === 'google', afterDelete: () => router.back() })}
      />
    </Screen>
  );
}

function BarButton({ icon, label, onPress, loading }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; loading?: boolean }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} disabled={loading} accessibilityLabel={label} style={[{ width: 74, height: 74, borderRadius: radius.xl, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }, elevation(c, 1)]}>
      <Ionicons name={icon} size={24} color={c.text} />
      <T v="caption" style={{ fontSize: 12.5, fontFamily: fonts.semibold }}>
        {loading ? '…' : label}
      </T>
    </Tap>
  );
}
