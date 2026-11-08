import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FadeIn, FadeInDown } from '../../theme/anim';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Chip, IconButton, T, Tap } from '../../components/ui';
import { fonts, radius, space, useTheme } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { discardWorking, ImageFormat, openWorking, saveWorking, transformWorking, Working } from '../../lib/tools';
import { DUR, EASE_OUT } from '../../theme/motion';

const ASPECTS = [
  { k: 'free', label: 'Free', r: 0 },
  { k: 'card', label: 'ID card', r: 1.586 },
  { k: 'a4', label: 'A4', r: 1 / 1.414 },
  { k: 'sq', label: 'Square', r: 1 },
] as const;
const QUALITY = [
  { label: 'Best', q: 0.92 },
  { label: 'Balanced', q: 0.75 },
  { label: 'Smallest', q: 0.5 },
];
const SIZES = [
  { label: 'Original', px: 0 },
  { label: '2000 px', px: 2000 },
  { label: '1200 px', px: 1200 },
];
const MIN = 48;

export default function ImageEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [work, setWork] = useState<Working | null>(null);
  const [busy, setBusy] = useState<string | null>('Decrypting…');
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]['k']>('free');
  const [format, setFormat] = useState<ImageFormat>('jpeg');
  const [quality, setQuality] = useState(0.92);
  const [maxSide, setMaxSide] = useState(0);
  const [tab, setTab] = useState<'crop' | 'export'>('crop');

  // Crop rect in display coordinates (relative to the displayed image).
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    openWorking(doc)
      .then((wk) => alive && (setWork(wk), setBusy(null)))
      .catch((e) => {
        Alert.alert('Can’t edit this image', e instanceof Error ? e.message : String(e));
        router.back();
      });
    return () => {
      alive = false;
    };
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => discardWorking(work), [work]);

  // Displayed image box (contain-fit within the editing area).
  const scale = work && area.w ? Math.min(area.w / work.width, area.h / work.height) : 0;
  const dw = work ? work.width * scale : 0;
  const dh = work ? work.height * scale : 0;

  const resetCrop = (ratio: number) => {
    if (!dw) return;
    let cw = dw * 0.9;
    let ch = dh * 0.9;
    if (ratio) {
      if (cw / ch > ratio) cw = ch * ratio;
      else ch = cw / ratio;
    }
    x.set(withTiming((dw - cw) / 2, { duration: DUR.base, easing: EASE_OUT }));
    y.set(withTiming((dh - ch) / 2, { duration: DUR.base, easing: EASE_OUT }));
    w.set(withTiming(cw, { duration: DUR.base, easing: EASE_OUT }));
    h.set(withTiming(ch, { duration: DUR.base, easing: EASE_OUT }));
  };

  useEffect(() => {
    resetCrop(ASPECTS.find((a) => a.k === aspect)!.r);
  }, [dw, dh, aspect]); // eslint-disable-line react-hooks/exhaustive-deps

  const ratio = ASPECTS.find((a) => a.k === aspect)!.r;

  const moveGesture = Gesture.Pan()
    .onBegin(() => {
      start.set({ x: x.get(), y: y.get(), w: w.get(), h: h.get() });
    })
    .onUpdate((e) => {
      const s = start.get();
      x.set(Math.min(Math.max(0, s.x + e.translationX), dw - s.w));
      y.set(Math.min(Math.max(0, s.y + e.translationY), dh - s.h));
    });

  const corner = (cx: -1 | 1, cy: -1 | 1) =>
    Gesture.Pan()
      .onBegin(() => {
        start.set({ x: x.get(), y: y.get(), w: w.get(), h: h.get() });
      })
      .onUpdate((e) => {
        const s = start.get();
        let nw = Math.max(MIN, s.w + cx * e.translationX);
        let nh = Math.max(MIN, s.h + cy * e.translationY);
        if (ratio) {
          // keep aspect, driven by the larger movement
          if (Math.abs(e.translationX) > Math.abs(e.translationY)) nh = nw / ratio;
          else nw = nh * ratio;
        }
        let nx = cx < 0 ? s.x + s.w - nw : s.x;
        let ny = cy < 0 ? s.y + s.h - nh : s.y;
        // clamp to image bounds
        if (nx < 0) {
          nw += nx;
          nx = 0;
          if (ratio) nh = nw / ratio;
        }
        if (ny < 0) {
          nh += ny;
          ny = 0;
          if (ratio) nw = nh * ratio;
        }
        if (nx + nw > dw) {
          nw = dw - nx;
          if (ratio) nh = nw / ratio;
        }
        if (ny + nh > dh) {
          nh = dh - ny;
          if (ratio) nw = nh * ratio;
        }
        if (cx < 0) nx = s.x + s.w - nw;
        if (cy < 0) ny = s.y + s.h - nh;
        x.set(nx);
        y.set(ny);
        w.set(nw);
        h.set(nh);
      });

  const boxStyle = useAnimatedStyle(() => ({ left: x.get(), top: y.get(), width: w.get(), height: h.get() }));
  const shadeTop = useAnimatedStyle(() => ({ height: y.get() }));
  const shadeBottom = useAnimatedStyle(() => ({ top: y.get() + h.get() }));
  const shadeLeft = useAnimatedStyle(() => ({ top: y.get(), height: h.get(), width: x.get() }));
  const shadeRight = useAnimatedStyle(() => ({ top: y.get(), height: h.get(), left: x.get() + w.get() }));

  const transform = async (op: 'left' | 'right' | 'flipH' | 'flipV') => {
    if (!work) return;
    Haptics.selectionAsync().catch(() => {});
    setBusy('Applying…');
    try {
      setWork(await transformWorking(work, op));
    } finally {
      setBusy(null);
    }
  };

  const save = async (mode: 'new' | 'replace') => {
    if (!doc || !work || !scale) return;
    setBusy('Encrypting…');
    const crop = {
      originX: Math.round(x.get() / scale),
      originY: Math.round(y.get() / scale),
      width: Math.round(w.get() / scale),
      height: Math.round(h.get() / scale),
    };
    const full = crop.width >= work.width - 2 && crop.height >= work.height - 2;
    try {
      const newId = await saveWorking(doc, work, { crop: full ? undefined : crop, maxSide: maxSide || undefined, format, quality }, mode, mode === 'new' ? `${doc.name} (edited)` : undefined);
      setWork(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/doc/${newId}`);
    } catch (e) {
      setBusy(null);
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : String(e));
    }
  };

  const handle = (cx: -1 | 1, cy: -1 | 1) => (
    <GestureDetector gesture={corner(cx, cy)}>
      <View
        hitSlop={18}
        style={{
          position: 'absolute',
          width: 26,
          height: 26,
          [cx < 0 ? 'left' : 'right']: -6,
          [cy < 0 ? 'top' : 'bottom']: -6,
          borderColor: '#fff',
          borderLeftWidth: cx < 0 ? 4 : 0,
          borderRightWidth: cx > 0 ? 4 : 0,
          borderTopWidth: cy < 0 ? 4 : 0,
          borderBottomWidth: cy > 0 ? 4 : 0,
          borderRadius: 4,
        }}
      />
    </GestureDetector>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0D17' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + space.sm, paddingHorizontal: space.xl }}>
        <IconButton icon="close" label="Cancel" onPress={() => router.back()} bg="rgba(255,255,255,0.12)" tint="#fff" />
        <T v="bodyStrong" color="#fff">
          Edit image
        </T>
        <IconButton icon="refresh" label="Reset crop" onPress={() => resetCrop(ratio)} bg="rgba(255,255,255,0.12)" tint="#fff" />
      </View>

      {/* Canvas */}
      <View style={{ flex: 1, margin: space.xl }} onLayout={(e: LayoutChangeEvent) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {work && dw > 0 && (
          <Animated.View entering={FadeIn} style={{ position: 'absolute', left: (area.w - dw) / 2, top: (area.h - dh) / 2, width: dw, height: dh }}>
            <Image source={{ uri: work.uri }} style={{ width: dw, height: dh }} contentFit="fill" cachePolicy="none" />
            {tab === 'crop' && (
              <>
                {[shadeTop, shadeBottom, shadeLeft, shadeRight].map((st, i) => (
                  <Animated.View key={i} pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)' }, i === 1 && { bottom: 0 }, st]} />
                ))}
                <GestureDetector gesture={moveGesture}>
                  <Animated.View style={[{ position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' }, boxStyle]}>
                    {/* rule-of-thirds grid */}
                    {[1, 2].map((k) => (
                      <View key={`v${k}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${(k * 100) / 3}%`, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                    ))}
                    {[1, 2].map((k) => (
                      <View key={`h${k}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: `${(k * 100) / 3}%`, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                    ))}
                    {handle(-1, -1)}
                    {handle(1, -1)}
                    {handle(-1, 1)}
                    {handle(1, 1)}
                  </Animated.View>
                </GestureDetector>
              </>
            )}
          </Animated.View>
        )}
        {busy && (
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <ActivityIndicator color="#fff" size="large" />
            <T v="callout" color="#fff">
              {busy}
            </T>
          </View>
        )}
      </View>

      {/* Controls sheet */}
      <Animated.View entering={FadeInDown.duration(DUR.slow).easing(EASE_OUT)} style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space.lg, paddingBottom: insets.bottom + space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignSelf: 'center', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
          {(['crop', 'export'] as const).map((t) => (
            <Tap key={t} onPress={() => setTab(t)} style={{ paddingHorizontal: space.xl, height: 36, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: tab === t ? c.surface : 'transparent' }}>
              <T v="callout" color={tab === t ? 'text' : 'muted'} style={{ fontFamily: fonts.semibold }}>
                {t === 'crop' ? 'Crop & rotate' : 'Format & size'}
              </T>
            </Tap>
          ))}
        </View>

        {tab === 'crop' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl }}>
              {ASPECTS.map((a) => (
                <Chip key={a.k} label={a.label} active={aspect === a.k} onPress={() => setAspect(a.k)} />
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
              {(
                [
                  ['left', 'arrow-undo', 'Rotate left'],
                  ['right', 'arrow-redo', 'Rotate right'],
                  ['flipH', 'swap-horizontal', 'Flip'],
                  ['flipV', 'swap-vertical', 'Flip vertical'],
                ] as const
              ).map(([op, icon, label]) => (
                <Tap key={op} onPress={() => transform(op)} disabled={!!busy} style={{ alignItems: 'center', gap: 4, width: 76 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={icon} size={22} color={c.text} />
                  </View>
                  <T v="caption" color="muted" numberOfLines={1}>
                    {label}
                  </T>
                </Tap>
              ))}
            </View>
          </>
        ) : (
          <View style={{ gap: space.md, paddingHorizontal: space.xl }}>
            <Row label="Format">
              {(['jpeg', 'png', 'webp'] as const).map((f) => (
                <Chip key={f} label={f === 'jpeg' ? 'JPG' : f.toUpperCase()} active={format === f} onPress={() => setFormat(f)} />
              ))}
            </Row>
            {format !== 'png' && (
              <Row label="Quality">
                {QUALITY.map((q) => (
                  <Chip key={q.label} label={q.label} active={quality === q.q} onPress={() => setQuality(q.q)} />
                ))}
              </Row>
            )}
            <Row label="Max size">
              {SIZES.map((s) => (
                <Chip key={s.label} label={s.label} active={maxSide === s.px} onPress={() => setMaxSide(s.px)} />
              ))}
            </Row>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl }}>
          <Button title="Replace" variant="secondary" onPress={() => save('replace')} disabled={!!busy || !work} style={{ flex: 1 }} />
          <Button title="Save as new" icon="checkmark" onPress={() => save('new')} disabled={!!busy || !work} style={{ flex: 1.5 }} />
        </View>
      </Animated.View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color="muted">
        {label}
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {children}
      </ScrollView>
    </View>
  );
}
