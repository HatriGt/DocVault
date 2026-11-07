import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { T } from './ui';
import { elevation, fonts, radius, useTheme } from '../theme';

const KINDS: { test: (ext: string, mime: string) => boolean; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { test: (e, m) => e === 'pdf' || m === 'application/pdf', color: '#E5484D', icon: 'document-text' },
  { test: (e) => ['doc', 'docx', 'odt', 'rtf'].includes(e), color: '#2B6CE6', icon: 'document' },
  { test: (e) => ['xls', 'xlsx', 'ods', 'csv'].includes(e), color: '#16A36A', icon: 'grid' },
  { test: (e) => ['ppt', 'pptx', 'odp', 'key'].includes(e), color: '#F07A2F', icon: 'easel' },
  { test: (_e, m) => m.startsWith('video/'), color: '#5B5F97', icon: 'videocam' },
  { test: (_e, m) => m.startsWith('audio/'), color: '#7A4F86', icon: 'musical-notes' },
  { test: () => true, color: '#5F5B76', icon: 'document-outline' },
];

export interface StackFile {
  uri: string;
  name: string;
  mime: string;
}

function Card({ f, i, n, size }: { f: StackFile; i: number; n: number; size: number }) {
  const { c } = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withDelay(i * 90, withSpring(1, { damping: 13, stiffness: 120 })));
  }, [v, i]);
  // Fan: centre card upright, others rotated outwards.
  const mid = (n - 1) / 2;
  const rot = n === 1 ? -4 : (i - mid) * 9;
  const dx = n === 1 ? 0 : (i - mid) * size * 0.28;
  const style = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateY: (1 - v.get()) * 60 }, { translateX: dx * v.get() }, { rotate: `${rot * v.get()}deg` }, { scale: 0.85 + v.get() * 0.15 }],
  }));
  const image = f.mime.startsWith('image/');
  const ext = (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? (f.mime === 'application/pdf' ? 'pdf' : 'file')).toLowerCase();
  const look = KINDS.find((k) => k.test(ext, f.mime)) ?? KINDS[KINDS.length - 1];
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size * 0.72, height: size, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden', zIndex: n - Math.abs(i - mid) },
        elevation(c, 2),
        style,
      ]}
    >
      {image ? (
        <Image source={{ uri: f.uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
      ) : (
        <View style={{ flex: 1, padding: size * 0.08, gap: size * 0.05 }}>
          <View style={{ width: '60%', height: size * 0.05, borderRadius: 3, backgroundColor: look.color }} />
          {[0.9, 1, 0.75, 0.95, 0.6, 0.85].map((w, k) => (
            <View key={k} style={{ width: `${w * 100}%`, height: size * 0.03, borderRadius: 2, backgroundColor: c.surfaceAlt }} />
          ))}
          <View style={{ position: 'absolute', bottom: size * 0.06, left: size * 0.08, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={look.icon} size={size * 0.1} color={look.color} />
            <T v="overline" color={look.color} style={{ fontFamily: fonts.extrabold, fontSize: size * 0.07 }}>
              {ext.toUpperCase()}
            </T>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

/** Up to three shared files fanned out like a hand of cards, springing in one by one. */
export function FileStack({ files, size = 150 }: { files: StackFile[]; size?: number }) {
  const shown = files.slice(0, 3);
  return (
    <View style={{ height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      {shown.map((f, i) => (
        <Card key={f.uri + i} f={f} i={i} n={shown.length} size={size} />
      ))}
    </View>
  );
}
