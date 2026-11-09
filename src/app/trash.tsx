import React, { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { FadeInDown, FadeOutLeft, LinearTransition } from '../theme/anim';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, T, Tap } from '../components/ui';
import { ScreenHeader } from '../components/ScreenHeader';
import { DocThumb } from '../components/docs';
import { Backdrop } from '../components/Backdrop';
import { radius, space, useTheme } from '../theme';
import { useTrash } from '../lib/hooks';
import { emptyTrash, purgeDocument, restoreDocument } from '../lib/documents';
import { formatBytes } from '../lib/format';
import { toast } from '../lib/toast';
import { DUR, EASE_OUT } from '../theme/motion';

/** Recently Deleted: restore within 30 days, or delete permanently. */
export default function Trash() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const items = useTrash();
  const [now] = useState(() => Date.now());
  const daysLeft = (t: number | null) => Math.max(0, 30 - Math.floor((now - (t ?? now)) / 86_400_000));

  const confirmEmpty = () =>
    Alert.alert('Empty Recently deleted?', `${items.length} documents will be permanently deleted from this device, your Drive and your other devices. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: () => emptyTrash(items).then(() => toast('Recently deleted emptied', { icon: 'checkmark-circle' })) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Recently deleted" subtitle="Documents are kept for 30 days, then removed for good." />
      <Backdrop variant="list" />
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + 120 }}
        ListEmptyComponent={<EmptyState icon="trash-outline" title="Nothing here" body="Deleted documents appear here for 30 days so you can restore them." />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35)} exiting={FadeOutLeft} layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
              <DocThumb doc={item} size={44} />
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" numberOfLines={1}>
                  {item.name}
                </T>
                <T v="caption" color={daysLeft(item.trashed_at) <= 3 ? c.danger : c.textMuted}>
                  {daysLeft(item.trashed_at)} days left · {formatBytes(item.size)}
                </T>
              </View>
              <Tap onPress={() => restoreDocument(item).then(() => toast(`Restored “${item.name}”`, { icon: 'arrow-undo' }))} accessibilityLabel={`Restore ${item.name}`} style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, justifyContent: 'center' }}>
                <T v="callout" color="accent">
                  Restore
                </T>
              </Tap>
              <Tap
                onPress={() =>
                  Alert.alert(`Delete “${item.name}” forever?`, 'This can’t be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => purgeDocument(item) },
                  ])
                }
                hitSlop={8}
                accessibilityLabel={`Delete ${item.name} forever`}
              >
                <Ionicons name="close-circle" size={24} color={c.textFaint} />
              </Tap>
            </View>
          </Animated.View>
        )}
      />
      {items.length > 0 && (
        <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: insets.bottom + space.lg, flexDirection: 'row', gap: space.md }}>
          <Button title="Restore all" variant="secondary" style={{ flex: 1 }} onPress={() => Promise.all(items.map(restoreDocument)).then(() => toast('All documents restored', { icon: 'arrow-undo' }))} />
          <Button title="Empty" variant="danger" style={{ flex: 1 }} onPress={confirmEmpty} />
        </View>
      )}
    </View>
  );
}
