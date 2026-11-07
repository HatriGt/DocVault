import React, { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState, Screen, SectionHeader, T, Tap } from '../../components/ui';
import { DocRow, WalletCard } from '../../components/docs';
import { space } from '../../theme';
import { useDocuments } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';

/** Apple Wallet-style stacked cards for favorites. */
export default function Favorites() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { docs, loading } = useDocuments();
  const favs = useMemo(() => docs.filter((d) => d.favorite).sort((a, b) => b.pinned - a.pinned), [docs]);
  const cards = favs.filter((d) => CARD_TYPES.has(d.doc_type ?? ''));
  const files = favs.filter((d) => !CARD_TYPES.has(d.doc_type ?? ''));
  const cardW = width - space.xl * 2;
  const cardH = cardW / 1.586;
  const peek = 64;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>
          <T v="title">Favorites</T>
          <T v="callout" color="muted" style={{ marginTop: 4 }}>
            Your most important documents, one tap away — even offline.
          </T>
        </View>
        {loading ? null : favs.length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            body="Tap the heart on any document to keep it here for instant access."
            action="Browse documents"
            onAction={() => router.push('/(tabs)/documents')}
          />
        ) : (
          <>
            {cards.length > 0 && (
              <View style={{ marginTop: space.xl, paddingHorizontal: space.xl, height: cardH + peek * (cards.length - 1) }}>
                {cards.map((d, i) => (
                  <Animated.View
                    key={d.id}
                    entering={FadeInDown.delay(i * 70).springify().damping(16)}
                    style={{ position: 'absolute', top: i * peek, left: space.xl }}
                  >
                    <Tap onPress={() => router.push(`/doc/${d.id}`)} scaleTo={0.98} accessibilityLabel={`Open ${d.name}`}>
                      <WalletCard doc={d} width={cardW} />
                    </Tap>
                  </Animated.View>
                ))}
              </View>
            )}
            {files.length > 0 && (
              <View style={{ paddingHorizontal: space.xl, marginTop: space.xxl }}>
                <SectionHeader title="Pinned files" />
                {files.map((d) => (
                  <DocRow key={d.id} doc={d} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
