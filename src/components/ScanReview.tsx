import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Button, T, Tap } from './ui';
import { elevation, fonts, radius, space, useTheme } from '../theme';
import { DUR, EASE_OUT } from '../theme/motion';
import { buildScan, discardScan, rotatePage, ScanPage, ScanResult, scanPages } from '../lib/scan';

/**
 * Review step after the system scanner: see every page large, rotate,
 * reorder, delete or add pages, then choose PDF or photo before saving.
 */
export function ScanReview({ initial, onDone, onCancel }: { initial: ScanPage[]; onDone: (r: ScanResult) => void; onCancel: () => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [pages, setPages] = useState(initial);
  const [asPdf, setAsPdf] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const tileW = (width - space.xl * 2 - space.md) / 2;

  const addMore = async () => {
    try {
      const more = await scanPages(20 - pages.length);
      if (more) setPages((p) => [...p, ...more]);
    } catch (e) {
      Alert.alert('Scanner unavailable', e instanceof Error ? e.message : String(e));
    }
  };
  const rotate = async (i: number) => {
    setBusy(`rotate-${i}`);
    try {
      const r = await rotatePage(pages[i], 90);
      setPages((p) => p.map((x, k) => (k === i ? r : x)));
    } finally {
      setBusy(null);
    }
  };
  const move = (i: number, d: -1 | 1) =>
    setPages((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const remove = (i: number) => {
    discardScan(pages[i].uri);
    setPages((p) => p.filter((_, k) => k !== i));
  };
  const finish = async () => {
    setBusy('build');
    try {
      onDone(await buildScan(pages, pages.length > 1 || asPdf));
    } catch (e) {
      setBusy(null);
      Alert.alert('Couldn’t prepare the scan', e instanceof Error ? e.message : String(e));
    }
  };
  const cancel = () => {
    pages.forEach((p) => discardScan(p.uri));
    onCancel();
  };

  const single = pages.length === 1;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }}>
        <Animated.View entering={FadeInDown.duration(DUR.slow).easing(EASE_OUT)}>
          <T v="title">{pages.length ? `${pages.length} ${single ? 'page' : 'pages'}` : 'No pages'}</T>
          <T v="callout" color="muted" style={{ marginTop: 4 }}>
            Check each page. Rotate, reorder or remove anything that isn’t right.
          </T>
        </Animated.View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xl }}>
          {pages.map((p, i) => (
            <Animated.View key={p.uri} layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)} entering={FadeIn.duration(DUR.base)} exiting={FadeOut.duration(DUR.fast)} style={{ width: tileW }}>
              <View style={[{ height: tileW * 1.3, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, elevation(c, 1)]}>
                <Image source={{ uri: p.uri }} style={{ flex: 1 }} contentFit="contain" transition={150} />
                {busy === `rotate-${i}` && (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                    <ActivityIndicator color={c.accent} />
                  </View>
                )}
                <View style={{ position: 'absolute', top: 8, left: 8, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                  <T v="caption" color={c.bg} style={{ fontFamily: fonts.bold }}>
                    {i + 1}
                  </T>
                </View>
                <Tap onPress={() => remove(i)} accessibilityLabel={`Remove page ${i + 1}`} hitSlop={8} style={{ position: 'absolute', top: 6, right: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(22,19,45,0.65)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Tap>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
                {(
                  [
                    { icon: 'chevron-back', label: `Move page ${i + 1} earlier`, on: () => move(i, -1), off: i === 0 },
                    { icon: 'refresh', label: `Rotate page ${i + 1}`, on: () => rotate(i), off: !!busy },
                    { icon: 'chevron-forward', label: `Move page ${i + 1} later`, on: () => move(i, 1), off: i === pages.length - 1 },
                  ] as const
                ).map((b) => (
                  <Tap key={b.label} onPress={b.on} disabled={b.off} accessibilityLabel={b.label} style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', opacity: b.off ? 0.3 : 1 }}>
                    <Ionicons name={b.icon} size={19} color={c.text} />
                  </Tap>
                ))}
              </View>
            </Animated.View>
          ))}
          {pages.length < 20 && (
            <Tap onPress={addMore} accessibilityLabel="Add more pages" style={{ width: tileW, height: tileW * 1.3, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.accent, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="add-circle" size={30} color={c.accent} />
              <T v="callout" color="accent" style={{ fontFamily: fonts.semibold }}>
                Add pages
              </T>
            </Tap>
          )}
        </View>
      </ScrollView>

      <View style={{ padding: space.xl, paddingTop: space.md, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline, backgroundColor: c.bg }}>
        {single && (
          <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
            {[
              { v: true, label: 'One PDF', icon: 'document-text-outline' as const },
              { v: false, label: 'Photo', icon: 'image-outline' as const },
            ].map((o) => (
              <Tap key={o.label} onPress={() => setAsPdf(o.v)} accessibilityState={{ selected: asPdf === o.v }} style={{ flex: 1, height: 40, borderRadius: radius.pill, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: asPdf === o.v ? c.surface : 'transparent' }}>
                <Ionicons name={o.icon} size={16} color={asPdf === o.v ? c.text : c.textMuted} />
                <T v="callout" color={asPdf === o.v ? 'text' : 'muted'} style={{ fontFamily: fonts.semibold }}>
                  {o.label}
                </T>
              </Tap>
            ))}
          </View>
        )}
        <T v="caption" color="muted" style={{ textAlign: 'center' }}>
          {pages.length === 0 ? 'Add at least one page to continue.' : single && !asPdf ? 'Saved as a photo.' : `${pages.length} ${single ? 'page' : 'pages'} → one PDF, encrypted on this phone.`}
        </T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Discard" variant="secondary" onPress={cancel} style={{ flex: 1 }} />
          <Button title="Continue" icon="arrow-forward" onPress={finish} loading={busy === 'build'} disabled={!pages.length || (!!busy && busy !== 'build')} style={{ flex: 1.6 }} />
        </View>
      </View>
    </View>
  );
}
