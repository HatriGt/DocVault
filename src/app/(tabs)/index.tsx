import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, EmptyState, Screen, SearchField, SectionHeader, T, Tap } from '../../components/ui';
import { DocRow, EssentialCard } from '../../components/docs';
import { SyncPill } from '../../components/SyncPill';
import { ActionSheet } from '../../components/Sheet';
import { Backdrop } from '../../components/Backdrop';
import { TAB_BAR_HEIGHT } from '../../components/TabBar';
import { TagPill } from '../../components/Tags';
import { FolderEditor } from '../../components/Folders';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useAccount, useCategories, useDocuments, useTags } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { daysUntil, greeting } from '../../lib/format';
import { syncNow } from '../../lib/sync';
import { docActions } from '../../lib/actions';
import type { DocRecord } from '../../lib/db';

const ESSENTIAL_ORDER = ['Passport', 'National ID', 'Driving Licence', 'Residence Permit', 'Visa', 'Aadhaar', 'PAN Card'];

const QUICK_BASE: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; go: () => void }[] = [
  { icon: 'camera', label: 'Scan', color: '#6A4BFF', go: () => router.push({ pathname: '/add', params: { source: 'camera' } }) },
  { icon: 'cloud-upload', label: 'Upload', color: '#2F9BEA', go: () => router.push({ pathname: '/add', params: { source: 'files' } }) },
  { icon: 'folder', label: 'New Folder', color: '#F5B32F', go: () => {} },
  { icon: 'color-wand', label: 'Tools', color: '#B84DF0', go: () => router.push('/tools') },
];

export default function Home() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const { docs, loading } = useDocuments();
  const categories = useCategories();
  const topTags = useTags().slice(0, 10);
  const [refreshing, setRefreshing] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const QUICK = QUICK_BASE.map((q) => (q.label === 'New Folder' ? { ...q, go: () => setNewFolder(true) } : q));

  const essentials = useMemo(() => {
    const cards = docs
      .filter((d) => CARD_TYPES.has(d.doc_type ?? '') || d.favorite)
      .sort((a, b) => {
        const ia = ESSENTIAL_ORDER.indexOf(a.doc_type ?? '');
        const ib = ESSENTIAL_ORDER.indexOf(b.doc_type ?? '');
        return (b.pinned - a.pinned) || ((ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib));
      });
    return cards.slice(0, 8);
  }, [docs]);

  const expiring = useMemo(
    () =>
      docs
        .map((d) => ({ d, days: daysUntil(d.expiry) }))
        .filter((x) => x.days != null && x.days <= 90)
        .sort((a, b) => a.days! - b.days!),
    [docs],
  );

  const name = account?.displayName ?? '';
  const pad = space.xl;
  const tileW = (width - pad * 2 - space.md * 3) / 4;
  const essW = Math.min((width - pad * 2 - space.md * 2) / 2.6, 160);

  const refresh = async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  return (
    <Screen>
      <Backdrop variant="home" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 48 }}
        refreshControl={account?.mode === 'google' ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, paddingTop: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Image source={require('../../../assets/logo.png')} style={{ width: 42, height: 42 }} contentFit="contain" />
            <T v="heading" style={{ fontFamily: fonts.extrabold, fontSize: 21 }}>
              DocVault
            </T>
          </View>
          <Tap onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Profile and settings">
            {account?.profile?.picture ? (
              <Image source={{ uri: account.profile.picture }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: c.surface }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.surface }}>
                <T v="bodyStrong" color="onAccent">
                  {(name[0] ?? 'D').toUpperCase()}
                </T>
              </View>
            )}
          </Tap>
        </View>

        {/* Greeting + hero */}
        <View style={{ paddingHorizontal: pad, marginTop: space.xl }}>
          <Animated.View entering={FadeInDown.duration(500)}>
            <T v="display" style={{ fontSize: 31, lineHeight: 37 }}>
              {greeting()},{'\n'}
              {name || 'there'} 👋
            </T>
            <T v="callout" color="muted" style={{ marginTop: space.xs, fontSize: 15 }}>
              Your secure document wallet
            </T>
            <View style={{ marginTop: space.md }}>
              <SyncPill />
            </View>
          </Animated.View>
        </View>
        <Animated.View entering={FadeInRight.delay(120).springify().damping(16)} style={{ alignItems: 'flex-end', marginTop: -space.xxl, paddingRight: pad - 8 }}>
          <Image source={require('../../../assets/hero.png')} style={{ width: width * 0.5, height: width * 0.42 }} contentFit="contain" />
        </Animated.View>

        {/* Search (overlaps hero, as in the design) */}
        <View style={{ paddingHorizontal: pad, marginTop: -space.xxl }}>
          <Tap onPress={() => router.push({ pathname: '/(tabs)/documents', params: { focus: '1' } })} haptic={false} scaleTo={0.99}>
            <View pointerEvents="box-none">
              <SearchField
                placeholder="Search documents"
                editable={false}
                pointerEvents="none"
                trailing={
                  <Tap
                    onPress={() => router.push({ pathname: '/add', params: { source: 'camera' } })}
                    hitSlop={10}
                    accessibilityLabel="Scan a document"
                  >
                    <Ionicons name="scan-outline" size={24} color={c.accent} />
                  </Tap>
                }
              />
            </View>
          </Tap>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: pad, marginTop: space.lg }}>
          {QUICK.map((q, i) => (
            <Animated.View key={q.label} entering={FadeInDown.delay(80 + i * 50).springify().damping(18)}>
              <Tap
                onPress={q.go}
                accessibilityLabel={q.label}
                style={[{ width: tileW, height: tileW * 1.02, borderRadius: radius.lg, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 8 }, elevation(c, 1)]}
              >
                <Ionicons name={q.icon} size={26} color={q.color} />
                <T v="caption" style={{ fontFamily: fonts.semibold, fontSize: 12.5, textAlign: 'center' }} numberOfLines={1}>
                  {q.label}
                </T>
              </Tap>
            </Animated.View>
          ))}
        </View>

        {loading ? null : docs.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="Your vault is empty"
            body="Add your passport, ID or any important document. It’s encrypted on your phone and available offline."
            action="Add your first document"
            onAction={() => router.push('/add')}
          />
        ) : (
          <>
            {expiring.length > 0 && (
              <View style={{ paddingHorizontal: pad, marginTop: space.xl }}>
                <Banner
                  tone={expiring[0].days! < 0 ? 'danger' : 'warning'}
                  icon="time-outline"
                  text={
                    expiring[0].days! < 0
                      ? `${expiring[0].d.name} has expired`
                      : `${expiring[0].d.name} expires in ${expiring[0].days} days${expiring.length > 1 ? ` · +${expiring.length - 1} more` : ''}`
                  }
                  action="View"
                  onAction={() => router.push(`/doc/${expiring[0].d.id}`)}
                />
              </View>
            )}

            {/* Your Essentials */}
            {essentials.length > 0 && (
              <View style={{ marginTop: space.xxl }}>
                <Tap onPress={() => router.push('/(tabs)/favorites')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: pad, marginBottom: space.md }}>
                  <T v="heading" style={{ fontFamily: fonts.extrabold, fontSize: 21 }}>
                    Your Essentials
                  </T>
                  <Ionicons name="chevron-forward" size={22} color={c.text} />
                </Tap>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: space.md, paddingBottom: space.md }}>
                  {essentials.map((d, i) => (
                    <Animated.View key={d.id} entering={FadeInRight.delay(i * 60).springify().damping(18)}>
                      <Tap onPress={() => router.push(`/doc/${d.id}`)} onLongPress={() => setMenuDoc(d)} accessibilityLabel={`Open ${d.name}`}>
                        <EssentialCard doc={d} width={essW} />
                      </Tap>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {topTags.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: pad, paddingTop: space.md }}>
                {topTags.map((t) => (
                  <TagPill key={t.tag} tag={t.tag} />
                ))}
              </ScrollView>
            )}

            {/* Recently added */}
            <View style={{ paddingHorizontal: pad, marginTop: space.xxl }}>
              <SectionHeader title="Recently added" action="See all" onAction={() => router.push('/(tabs)/documents')} />
              {docs.slice(0, 4).map((d) => (
                <DocRow key={d.id} doc={d} onMore={setMenuDoc} />
              ))}
            </View>

            {/* Categories */}
            <View style={{ paddingHorizontal: pad, marginTop: space.xxl }}>
              <SectionHeader title="Categories" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                {categories.slice(0, 4).map((cat) => {
                  const count = docs.filter((d) => d.category === cat.id).length;
                  return (
                    <Tap
                      key={cat.id}
                      onPress={() => router.push({ pathname: '/(tabs)/documents', params: { category: cat.id } })}
                      style={[{ width: (width - pad * 2 - space.md) / 2, borderRadius: radius.lg, backgroundColor: c.surface, padding: space.lg, gap: space.md }, elevation(c, 1)]}
                    >
                      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: cat.hue + '1F', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={21} color={cat.hue} />
                      </View>
                      <View>
                        <T v="bodyStrong">{cat.name}</T>
                        <T v="caption" color="muted">
                          {count} {count === 1 ? 'document' : 'documents'}
                        </T>
                      </View>
                    </Tap>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <FolderEditor visible={newFolder} onClose={() => setNewFolder(false)} parentId={null} onSaved={(f) => router.push(`/folder/${f.id}`)} />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
    </Screen>
  );
}

/** Large accent "+" button, floating above the tab bar. */
export function Fab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', right: space.xl, bottom: Math.max(insets.bottom, space.md) + TAB_BAR_HEIGHT + space.lg }}>
      <Tap
        onPress={() => router.push('/add')}
        accessibilityLabel="Add document"
        style={[{ width: 68, height: 68, borderRadius: 34, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, elevation(c, 3)]}
      >
        <Ionicons name="add" size={34} color={c.onAccent} />
      </Tap>
    </View>
  );
}
