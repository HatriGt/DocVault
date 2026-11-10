import React, { useEffect, useRef, useState } from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { T } from './ui';
import { radius, space, useTheme } from '../theme';

// ---------- Swipe actions ----------
function Action({ progress, icon, color, label, side }: { progress: SharedValue<number>; icon: keyof typeof Ionicons.glyphMap; color: string; label: string; side: 'left' | 'right' }) {
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.get(), [0, 1, 1.4], [0.6, 1, 1.12], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={{ width: 96, alignItems: side === 'left' ? 'flex-start' : 'flex-end', justifyContent: 'center', paddingHorizontal: space.lg }}>
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, st]}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        <T v="caption" color={color}>
          {label}
        </T>
      </Animated.View>
    </View>
  );
}

/** Row with swipe-right = favourite, swipe-left = delete (fires on full swipe). */
export function SwipeRow({ children, favorite, onFavorite, onDelete }: { children: React.ReactNode; favorite: boolean; onFavorite: () => void; onDelete: () => void }) {
  const { c } = useTheme();
  const ref = useRef<React.ComponentRef<typeof ReanimatedSwipeable>>(null);
  const translation = useRef<SharedValue<number> | null>(null);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      leftThreshold={70}
      rightThreshold={70}
      overshootFriction={6}
      renderLeftActions={(p, t) => (translation.current = t) && <Action progress={p} icon={favorite ? 'heart-dislike' : 'heart'} color={c.accent} label={favorite ? 'Remove' : 'Wallet'} side="left" />}
      renderRightActions={(p, t) => (translation.current = t) && <Action progress={p} icon="trash" color={c.danger} label="Delete" side="right" />}
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
      onSwipeableOpen={() => {
        // Decide by the actual drag direction (robust across library versions):
        // positive translation = swiped right = favourite; negative = delete.
        const swipedRight = (translation.current?.get() ?? 0) > 0;
        ref.current?.close();
        if (swipedRight) onFavorite();
        else onDelete();
      }}
    >
      <View style={{ backgroundColor: c.bg }}>{children}</View>
    </ReanimatedSwipeable>
  );
}

// ---------- Wallet carousel with depth ----------

/** Horizontal snap carousel where the centred card is full size and neighbours recede. */
// ---------- Skeleton shimmer ----------
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1100 }), -1, true));
  }, [t]);
  const st = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [0, 1], [0.45, 1]) }));
  return <Animated.View style={[{ backgroundColor: c.surfaceAlt, borderRadius: radius.md }, style, st]} />;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <View style={{ gap: space.lg, paddingVertical: space.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Skeleton style={{ width: 48, height: 48, borderRadius: 14 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 14, width: `${70 - (i % 3) * 12}%` }} />
            <Skeleton style={{ height: 11, width: '40%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Count-up number ----------
/** Number that eases from its previous value to the new one (ease-out cubic). */
export function useCountUp(target: number, duration = 700) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}
