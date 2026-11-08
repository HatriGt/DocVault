import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import Animated, { useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { FadeInDown } from '../../theme/anim';
import { T } from '../../components/ui';
import { radius, space, useTheme } from '../../theme';
import { useCategories, useDocuments, useFolders, useTags } from '../../lib/hooks';
import { formatBytes, daysUntil } from '../../lib/format';

const kindOf = (mime: string) =>
  mime === 'application/pdf' ? 'PDF' : mime.startsWith('image/') ? 'Images' : mime.startsWith('video/') ? 'Video' : mime.startsWith('audio/') ? 'Audio' : /word|excel|spreadsheet|presentation|officedocument|msword/.test(mime) ? 'Office' : 'Other';
const KIND_COLOR: Record<string, string> = { PDF: '#C2413A', Images: '#F2994A', Office: '#2B5FD9', Video: '#5B5F97', Audio: '#7A4F86', Other: '#7C7B74' };

function Bar({ share, color, delay }: { share: number; color: string; delay: number }) {
  const { c } = useTheme();
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: withDelay(delay, withTiming(share, { duration: 600 })) }] }));
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 8, width: '100%', borderRadius: 4, backgroundColor: color, transformOrigin: 'left' }, st]} />
    </View>
  );
}

/** Vault insights: storage by format and category, offline coverage, renewals. */
export default function Insights() {
  const { c } = useTheme();
  const { docs } = useDocuments();
  const categories = useCategories();
  const folders = useFolders();
  const tags = useTags();
  const total = docs.reduce((n, d) => n + d.size, 0) || 1;
   
  const onDevice = useMemo(() => docs.reduce((n, d) => n + (d.has_local ? d.size : 0), 0), [docs]);
  const byKind = Object.entries(
    docs.reduce<Record<string, number>>((m, d) => ((m[kindOf(d.mime)] = (m[kindOf(d.mime)] ?? 0) + d.size), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  const byCat = categories
    .map((cat) => ({ cat, n: docs.filter((d) => d.category === cat.id).length }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);
  const expiring = docs.filter((d) => (daysUntil(d.expiry) ?? 999) <= 90).length;

  const stat = (k: string, v: string) => (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
      <T v="title" style={{ fontSize: 30, lineHeight: 34 }}>
        {v}
      </T>
      <T v="caption" color="muted">
        {k}
      </T>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: 'Vault insights' }} />
      <Animated.View entering={FadeInDown} style={{ backgroundColor: c.hero, borderRadius: radius.xl, padding: space.xl }}>
        <T v="overline" color={c.heroMuted}>
          TOTAL STORED
        </T>
        <T v="display" color={c.heroText} style={{ marginTop: space.xs }}>
          {formatBytes(total === 1 ? 0 : total)}
        </T>
        <T v="callout" color={c.heroMuted}>
          {docs.length} documents · {formatBytes(onDevice)} encrypted on this device
        </T>
      </Animated.View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {stat('On this phone', `${docs.filter((d) => d.has_local).length}`)}
        {stat('Expiring ≤ 90d', `${expiring}`)}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {stat('Folders', `${folders.length}`)}
        {stat('Tags', `${tags.length}`)}
      </View>
      <View style={{ gap: space.md }}>
        <T v="heading">By format</T>
        {byKind.map(([k, size], i) => (
          <View key={k} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T v="callout">{k}</T>
              <T v="caption" color="muted">
                {formatBytes(size)} · {Math.round((size / total) * 100)}%
              </T>
            </View>
            <Bar share={size / total} color={KIND_COLOR[k]} delay={i * 80} />
          </View>
        ))}
      </View>
      <View style={{ gap: space.md }}>
        <T v="heading">By category</T>
        {byCat.map(({ cat, n }, i) => (
          <View key={cat.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T v="callout">{cat.name}</T>
              <T v="caption" color="muted">
                {n} {n === 1 ? 'document' : 'documents'}
              </T>
            </View>
            <Bar share={n / docs.length} color={c.gold} delay={i * 80} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
