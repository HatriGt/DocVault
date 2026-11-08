import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, ScrollView, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { FadeIn, FadeOut } from '../../theme/anim';
import { Chip, T, Tap } from '../ui';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { readSheets, SheetBook } from '../../lib/officeRender';

// ---------- PDF ----------
export function PdfView({ uri }: { uri: string }) {
  const { c } = useTheme();
  const [page, setPage] = useState({ n: 1, of: 0 });
  const [showPager, setShowPager] = useState(true);
  useEffect(() => {
    if (!page.of) return;
    const t = setTimeout(() => setShowPager(false), 1800);
    return () => clearTimeout(t);
  }, [page.n, page.of]);
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceAlt }}>
      <Pdf
        source={{ uri }}
        style={{ flex: 1, backgroundColor: c.surfaceAlt }}
        spacing={10}
        fitPolicy={0}
        maxScale={6}
        enableAntialiasing
        onLoadComplete={(of) => (setShowPager(true), setPage({ n: 1, of }))}
        onPageChanged={(n, of) => (setShowPager(true), setPage({ n, of }))}
        renderActivityIndicator={() => <ActivityIndicator color={c.accent} />}
      />
      {showPager && page.of > 0 && (
        <Animated.View entering={FadeIn} exiting={FadeOut} pointerEvents="none" style={{ position: 'absolute', bottom: space.xxl, alignSelf: 'center', backgroundColor: 'rgba(20,17,43,0.82)', paddingHorizontal: space.lg, height: 34, borderRadius: radius.pill, justifyContent: 'center' }}>
          <T v="callout" color="#fff" style={{ fontFamily: fonts.semibold }}>
            {page.n} / {page.of}
          </T>
        </Animated.View>
      )}
    </View>
  );
}

// ---------- Image (pinch, pan, double-tap) ----------
export function ImageView({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => scale.set(Math.max(1, Math.min(saved.get() * e.scale, 6))))
    .onEnd(() => saved.set(scale.get()));
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.get() > 1) {
        tx.set(sx.get() + e.translationX);
        ty.set(sy.get() + e.translationY);
      }
    })
    .onEnd(() => {
      sx.set(tx.get());
      sy.set(ty.get());
    });
  const dbl = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.get() > 1 ? 1 : 2.5;
      scale.set(withSpring(next));
      saved.set(next);
      if (next === 1) {
        tx.set(withSpring(0));
        ty.set(withSpring(0));
        sx.set(0);
        sy.set(0);
      }
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, dbl)}>
      <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, style]}>
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" cachePolicy="none" transition={150} />
      </Animated.View>
    </GestureDetector>
  );
}

// ---------- Video ----------
export function VideoViewer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
      <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9 }} nativeControls allowsPictureInPicture contentFit="contain" />
    </View>
  );
}

// ---------- Audio ----------
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AudioViewer({ uri, title }: { uri: string; title: string }) {
  const { c } = useTheme();
  const player = useAudioPlayer(uri);
  const st = useAudioPlayerStatus(player);
  const [barW, setBarW] = useState(1);
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.set(st.playing ? withRepeat(withTiming(spin.get() + 360, { duration: 6000, easing: Easing.linear }), -1) : spin.get());
  }, [st.playing, spin]);
  const disc = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const progress = st.duration ? st.currentTime / st.duration : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.xxl, backgroundColor: c.bg }}>
      <Animated.View style={[{ width: 220, height: 220, borderRadius: 110, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, elevation(c, 3), disc]}>
        <View style={{ width: 170, height: 170, borderRadius: 85, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-notes" size={64} color="#fff" />
        </View>
      </Animated.View>
      <T v="heading" numberOfLines={2} style={{ textAlign: 'center' }}>
        {title}
      </T>
      <View style={{ alignSelf: 'stretch', gap: space.sm }}>
        <Tap
          haptic={false}
          scaleTo={1}
          onPress={() => {}}
          onPressIn={(e) => st.duration && player.seekTo((e.nativeEvent.locationX / barW) * st.duration)}
          style={{ height: 24, justifyContent: 'center' }}
        >
          <View onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)} style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${progress * 100}%`, backgroundColor: c.accent, borderRadius: 3 }} />
          </View>
        </Tap>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="caption" color="muted">
            {mmss(st.currentTime)}
          </T>
          <T v="caption" color="muted">
            {st.duration ? mmss(st.duration) : '--:--'}
          </T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxl }}>
        <Tap onPress={() => player.seekTo(Math.max(0, st.currentTime - 15))} accessibilityLabel="Back 15 seconds">
          <Ionicons name="play-back" size={30} color={c.text} />
        </Tap>
        <Tap
          onPress={() => (st.playing ? player.pause() : (st.didJustFinish && player.seekTo(0), player.play()))}
          accessibilityLabel={st.playing ? 'Pause' : 'Play'}
          style={[{ width: 76, height: 76, borderRadius: 38, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, elevation(c, 2)]}
        >
          {!st.isLoaded ? <ActivityIndicator color="#fff" /> : <Ionicons name={st.playing ? 'pause' : 'play'} size={34} color="#fff" style={{ marginLeft: st.playing ? 0 : 4 }} />}
        </Tap>
        <Tap onPress={() => player.seekTo(Math.min(st.duration || 0, st.currentTime + 15))} accessibilityLabel="Forward 15 seconds">
          <Ionicons name="play-forward" size={30} color={c.text} />
        </Tap>
      </View>
    </View>
  );
}

// ---------- HTML (Word / text) ----------
/** Locked-down WebView: no JS, no network, local HTML only. */
export function HtmlView({ html }: { html: string }) {
  const { c } = useTheme();
  return (
    <WebView
      originWhitelist={['about:blank']}
      source={{ html }}
      javaScriptEnabled={false}
      domStorageEnabled={false}
      allowFileAccess={false}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
      style={{ flex: 1, backgroundColor: c.surface }}
      startInLoadingState
      renderLoading={() => (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      )}
    />
  );
}

// ---------- Spreadsheet ----------
export function SheetView({ bytes, ext }: { bytes: Uint8Array; ext: string }) {
  const { dark } = useTheme();
  const [i, setI] = useState(0);
  const { book, error } = useMemo((): { book: SheetBook | null; error: string | null } => {
    try {
      return { book: readSheets(bytes, ext), error: null };
    } catch (e) {
      return { book: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [bytes, ext]);
  if (error) return <Message icon="alert-circle-outline" text={`Couldn’t read this spreadsheet: ${error}`} />;
  if (!book) return <Message loading text="Reading spreadsheet…" />;
  return (
    <View style={{ flex: 1 }}>
      {book.names.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, padding: space.md }}>
          {book.names.map((n, k) => (
            <Chip key={n} label={n} icon="grid-outline" active={k === i} onPress={() => setI(k)} />
          ))}
        </ScrollView>
      )}
      <HtmlView html={book.html(i, dark)} />
    </View>
  );
}

export function Message({ icon, text, loading }: { icon?: keyof typeof Ionicons.glyphMap; text: string; loading?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
      {loading ? <ActivityIndicator color={c.accent} size="large" /> : icon && <Ionicons name={icon} size={36} color={c.textMuted} />}
      <T v="callout" color="muted" style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}
