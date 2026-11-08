import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Backdrop } from '../../components/Backdrop';
import { TabSwipe } from '../../components/TabSwipe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, EmptyState, IconButton, Screen, SectionHeader, T, Tap } from '../../components/ui';
import { kvGet } from '../../lib/db';
import { DocRow, EssentialCard } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { VaultCard } from '../../components/VaultCard';
import { CountdownRing } from '../../components/CountdownRing';
import { TAB_BAR_HEIGHT } from '../../components/TabBar';
import { FolderEditor, FolderTile } from '../../components/Folders';
import { fonts, radius, space, useTheme } from '../../theme';
import { useAccount, useDocuments, useFolders } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { daysUntil, formatDate, greeting } from '../../lib/format';
import { syncNow } from '../../lib/sync';
import { confirmDelete, docActions } from '../../lib/actions';
import { toggleFavorite } from '../../lib/documents';
import { SkeletonRows, SwipeRow, WalletCarousel } from '../../components/motion';
import type { DocRecord } from '../../lib/db';

const ESSENTIAL_ORDER = ['Passport', 'National ID', 'Driving Licence', 'Residence Permit', 'Visa', 'Aadhaar', 'PAN Card'];

export default function Home() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const { docs, loading } = useDocuments();
  const folders = useFolders();
  const [refreshing, setRefreshing] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [unconfirmedKey, setUnconfirmedKey] = useState(false);
  useEffect(() => {
    kvGet<boolean>('recovery.unconfirmed', false).then(setUnconfirmedKey);
  }, []);
  const pad = space.xl;

  const wallet = useMemo(
    () =>
      docs
        .filter((d) => CARD_TYPES.has(d.doc_type ?? '') || d.favorite)
        .sort((a, b) => {
          const ia = ESSENTIAL_ORDER.indexOf(a.doc_type ?? '');
          const ib = ESSENTIAL_ORDER.indexOf(b.doc_type ?? '');
          return b.pinned - a.pinned || (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        })
        .slice(0, 10),
    [docs],
  );
  const attention = useMemo(
    () =>
      docs
        .map((d) => ({ d, days: daysUntil(d.expiry) }))
        .filter((x) => x.days != null && x.days <= 90)
        .sort((a, b) => a.days! - b.days!),
    [docs],
  );
  const rootFolders = folders.filter((f) => !f.parent_id).slice(0, 4);

  const first = account?.displayName ?? '';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const cardW = Math.min(width * 0.78, 330);
  const QUICK: { icon: keyof typeof Ionicons.glyphMap; label: string; go: () => void }[] = [
    { icon: 'scan-outline', label: 'Scan', go: () => router.push('/add') },
    { icon: 'arrow-down-circle-outline', label: 'Import', go: () => router.push('/add') },
    { icon: 'folder-open-outline', label: 'Folder', go: () => setNewFolder(true) },
    { icon: 'color-wand-outline', label: 'Tools', go: () => router.push('/tools') },
  ];

  const refresh = async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  return (
    <TabSwipe>
    <Screen>
      <Backdrop variant="home" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 56 }}
        refreshControl={account?.mode === 'google' ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.gold} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, paddingTop: space.sm }}>
          <T v="overline" color="muted">
            {today.toUpperCase()}
          </T>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <IconButton icon="search" label="Search" onPress={() => router.push('/search')} size={40} />
            <Tap onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Your profile">
              {account?.profile?.picture ? (
                <Image source={{ uri: account.profile.picture }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="bodyStrong" color="#FFFFFF">
                    {(first[0] ?? 'D').toUpperCase()}
                  </T>
                </View>
              )}
            </Tap>
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(500)} style={{ paddingHorizontal: pad, marginTop: space.lg }}>
          <T v="display">
            {greeting()},{'\n'}
            <T v="display" style={{ fontFamily: fonts.serifItalic, color: c.gold }}>
              {first || 'welcome'}
            </T>
          </T>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={{ paddingHorizontal: pad, marginTop: space.xl }}>
          <VaultCard />
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(140).duration(500)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: pad + space.sm, marginTop: space.xl }}>
          {QUICK.map((q) => (
            <Tap key={q.label} onPress={q.go} accessibilityLabel={q.label} style={{ alignItems: 'center', gap: 8, width: 68 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={q.icon} size={23} color={c.text} />
              </View>
              <T v="caption" color="muted">
                {q.label}
              </T>
            </Tap>
          ))}
        </Animated.View>

        {unconfirmedKey && (
          <View style={{ paddingHorizontal: pad, marginTop: space.xl }}>
            <Banner tone="danger" icon="key-outline" text="Your recovery key was never confirmed. Create a new one so you can't lose your vault." action="Fix" onAction={() => router.push('/manage/recovery')} />
          </View>
        )}
        {loading ? (
          <View style={{ paddingHorizontal: pad, marginTop: space.xxl }}>
            <SkeletonRows count={4} />
          </View>
        ) : docs.length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title="Your vault is ready"
            body="Add your passport, ID or any important file. It’s encrypted on this phone and always available offline."
            action="Add your first document"
            onAction={() => router.push('/add')}
          />
        ) : (
          <>
            {/* Needs attention */}
            {attention.length > 0 && (
              <View style={{ paddingHorizontal: pad, marginTop: space.xxl }}>
                <SectionHeader title="Needs attention" action={attention.length > 3 ? `All ${attention.length}` : 'Renewals'} onAction={() => router.push('/renewals')} />
                <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, paddingHorizontal: space.lg }}>
                  {attention.slice(0, 3).map(({ d, days }, i) => (
                    <Tap
                      key={d.id}
                      onPress={() => router.push(`/doc/${d.id}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: c.hairline }}
                    >
                      <CountdownRing days={days!} size={42} />
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong" numberOfLines={1}>
                          {d.name}
                        </T>
                        <T v="caption" color="muted">
                          {days! < 0 ? `Expired ${formatDate(d.expiry)}` : `Expires ${formatDate(d.expiry)}`}
                        </T>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                    </Tap>
                  ))}
                </View>
              </View>
            )}

            {/* Wallet */}
            {wallet.length > 0 && (
              <View style={{ marginTop: space.xxl }}>
                <View style={{ paddingHorizontal: pad }}>
                  <SectionHeader title="Wallet" action="Open" onAction={() => router.push('/(tabs)/favorites')} />
                </View>
                <WalletCarousel
                  data={wallet}
                  itemWidth={cardW}
                  gap={space.md}
                  padding={pad}
                  keyOf={(d) => d.id}
                  render={(d) => (
                    <Tap onPress={() => router.push(`/doc/${d.id}`)} onLongPress={() => setMenuDoc(d)} scaleTo={0.98} accessibilityLabel={`Open ${d.name}`}>
                      <EssentialCard doc={d} width={cardW} />
                    </Tap>
                  )}
                />
              </View>
            )}

            {/* Folders */}
            <View style={{ paddingHorizontal: pad, marginTop: space.xl }}>
              <SectionHeader title="Folders" action={rootFolders.length ? 'Library' : 'New'} onAction={() => (rootFolders.length ? router.push('/(tabs)/documents') : setNewFolder(true))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                {rootFolders.map((f) => (
                  <FolderTile key={f.id} folder={f} width={(width - pad * 2 - space.md) / 2} onPress={() => router.push(`/folder/${f.id}`)} />
                ))}
                {rootFolders.length < 2 && (
                  <Tap
                    onPress={() => setNewFolder(true)}
                    style={{ width: (width - pad * 2 - space.md) / 2, height: 132, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Ionicons name="add" size={22} color={c.textMuted} />
                    <T v="callout" color="muted">
                      New folder
                    </T>
                  </Tap>
                )}
              </View>
            </View>

            {/* Recent */}
            <View style={{ paddingHorizontal: pad, marginTop: space.xxl }}>
              <SectionHeader title="Recent" action="See all" onAction={() => router.push('/(tabs)/documents')} />
              {docs.slice(0, 5).map((d) => (
                <SwipeRow key={d.id} favorite={!!d.favorite} onFavorite={() => toggleFavorite(d)} onDelete={() => confirmDelete(d)}>
                  <DocRow doc={d} onMore={setMenuDoc} />
                </SwipeRow>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <FolderEditor visible={newFolder} onClose={() => setNewFolder(false)} parentId={null} onSaved={(f) => router.push(`/folder/${f.id}`)} />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
    </Screen>
    </TabSwipe>
  );
}

/** Kept for screens that still show a floating add button (folders). */
export function Fab() {
  return null;
}
