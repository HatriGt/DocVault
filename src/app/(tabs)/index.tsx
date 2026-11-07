import React, { useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, EmptyState, Screen, SearchField, SectionHeader, T, Tap } from '../../components/ui';
import { DocRow, WalletCard, DocThumb, categoryOf } from '../../components/docs';
import { SyncPill } from '../../components/SyncPill';
import { ActionSheet } from '../../components/Sheet';
import { radius, space, useTheme, elevation } from '../../theme';
import { useAccount, useCategories, useDocuments } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { daysUntil, greeting } from '../../lib/format';
import { syncNow } from '../../lib/sync';
import { docActions } from '../../lib/actions';
import type { DocRecord } from '../../lib/db';

const ESSENTIAL_ORDER = ['Passport', 'National ID', 'Driving Licence', 'Residence Permit', 'Visa', 'Aadhaar', 'PAN Card'];

export default function Home() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { account } = useAccount();
  const { docs, loading } = useDocuments();
  const categories = useCategories();
  const [refreshing, setRefreshing] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);

  const essentials = useMemo(() => {
    const pinned = docs.filter((d) => d.pinned || d.favorite);
    const ids = docs
      .filter((d) => CARD_TYPES.has(d.doc_type ?? ''))
      .sort((a, b) => ESSENTIAL_ORDER.indexOf(a.doc_type!) - ESSENTIAL_ORDER.indexOf(b.doc_type!));
    const seen = new Set<string>();
    return [...pinned.filter((d) => CARD_TYPES.has(d.doc_type ?? '')), ...ids, ...pinned].filter((d) => !seen.has(d.id) && seen.add(d.id)).slice(0, 8);
  }, [docs]);

  const recentlyAdded = docs.slice(0, 4);
  const recentlyOpened = useMemo(
    () => docs.filter((d) => d.accessed_at).sort((a, b) => b.accessed_at! - a.accessed_at!).slice(0, 6),
    [docs],
  );
  const expiring = useMemo(
    () =>
      docs
        .map((d) => ({ d, days: daysUntil(d.expiry) }))
        .filter((x) => x.days != null && x.days <= 90)
        .sort((a, b) => a.days! - b.days!),
    [docs],
  );

  const cardW = Math.min(width * 0.72, 300);
  const name = account?.displayName ?? '';

  const refresh = async () => {
    setRefreshing(true);
    await syncNow();
    setRefreshing(false);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={account?.mode === 'google' ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <SyncPill />
            <Tap onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Profile and settings">
              {account?.profile?.picture ? (
                <Image source={{ uri: account.profile.picture }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="bodyStrong" color="accent">
                    {(name[0] ?? 'D').toUpperCase()}
                  </T>
                </View>
              )}
            </Tap>
          </View>
          <T v="display" style={{ marginTop: space.xl }}>
            {greeting()}
            {name ? `,\n${name}` : ''}
          </T>
          <T v="body" color="muted" style={{ marginTop: space.xs }}>
            {docs.length ? `${docs.length} documents, always with you` : 'Your secure document wallet'}
          </T>
          <Tap onPress={() => router.push({ pathname: '/(tabs)/documents', params: { focus: '1' } })} haptic={false} style={{ marginTop: space.xl }}>
            <View pointerEvents="none">
              <SearchField placeholder="Search documents" editable={false} />
            </View>
          </Tap>
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, marginTop: space.xl }}>
          {[
            { icon: 'scan' as const, label: 'Scan', source: 'camera' },
            { icon: 'document-attach-outline' as const, label: 'Import', source: 'files' },
            { icon: 'images-outline' as const, label: 'Photos', source: 'photos' },
          ].map((a) => (
            <Tap
              key={a.label}
              onPress={() => router.push({ pathname: '/add', params: { source: a.source } })}
              style={{ flex: 1, height: 76, borderRadius: radius.lg, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name={a.icon} size={24} color={c.accent} />
              <T v="caption">{a.label}</T>
            </Tap>
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
              <View style={{ paddingHorizontal: space.xl, marginTop: space.xl }}>
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

            {/* Essentials wallet */}
            {essentials.length > 0 && (
              <View style={{ marginTop: space.xxl }}>
                <View style={{ paddingHorizontal: space.xl }}>
                  <SectionHeader title="Your essentials" action="Favorites" onAction={() => router.push('/(tabs)/favorites')} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={cardW + space.md}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.lg }}
                >
                  {essentials.map((d, i) => (
                    <Animated.View key={d.id} entering={FadeInDown.delay(i * 60).springify().damping(18)}>
                      <Tap onPress={() => router.push(`/doc/${d.id}`)} onLongPress={() => setMenuDoc(d)} accessibilityLabel={`Open ${d.name}`}>
                        {CARD_TYPES.has(d.doc_type ?? '') ? (
                          <WalletCard doc={d} width={cardW} />
                        ) : (
                          <View
                            style={[
                              { width: cardW, height: cardW / 1.586, borderRadius: 18, backgroundColor: c.surface, padding: space.lg, justifyContent: 'space-between' },
                              elevation(c, 1),
                            ]}
                          >
                            <DocThumb doc={d} size={44} />
                            <View>
                              <T v="bodyStrong" numberOfLines={1}>
                                {d.name}
                              </T>
                              <T v="caption" color="muted">
                                {categoryOf(d.category)?.name}
                              </T>
                            </View>
                          </View>
                        )}
                      </Tap>
                    </Animated.View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Recently accessed */}
            {recentlyOpened.length > 0 && (
              <View style={{ marginTop: space.lg }}>
                <View style={{ paddingHorizontal: space.xl }}>
                  <SectionHeader title="Jump back in" />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.lg }}>
                  {recentlyOpened.map((d) => (
                    <Tap key={d.id} onPress={() => router.push(`/doc/${d.id}`)} style={{ width: 76, alignItems: 'center', gap: 6 }}>
                      <DocThumb doc={d} size={64} />
                      <T v="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
                        {d.name}
                      </T>
                    </Tap>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Categories */}
            <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
              <SectionHeader title="Categories" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                {categories.slice(0, 4).map((cat) => {
                  const count = docs.filter((d) => d.category === cat.id).length;
                  return (
                    <Tap
                      key={cat.id}
                      onPress={() => router.push({ pathname: '/(tabs)/documents', params: { category: cat.id } })}
                      style={{ width: (width - space.xl * 2 - space.md) / 2, borderRadius: radius.lg, backgroundColor: c.surface, padding: space.lg, gap: space.md }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: cat.hue + '1F', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={cat.icon as keyof typeof Ionicons.glyphMap} size={20} color={cat.hue} />
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

            {/* Recently added */}
            <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
              <SectionHeader title="Recently added" action="See all" onAction={() => router.push('/(tabs)/documents')} />
              {recentlyAdded.map((d) => (
                <DocRow key={d.id} doc={d} onMore={setMenuDoc} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Fab />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
    </Screen>
  );
}

export function Fab() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', right: space.xl, bottom: insets.bottom + 70 }}>
      <Tap
        onPress={() => router.push('/add')}
        accessibilityLabel="Add document"
        style={[{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, elevation(c, 3)]}
      >
        <Ionicons name="add" size={30} color={c.onAccent} />
      </Tap>
    </View>
  );
}

