import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FadeInDown } from '../theme/anim';
import * as Haptics from 'expo-haptics';
import { T } from './ui';
import { space, useTheme } from '../theme';
import { DUR, EASE_OUT } from '../theme/motion';

const PARTICLES = 14;
const COLORS = ['#5B45F2', '#F2C14E', '#2F80ED', '#E5484D', '#15A06A', '#B04CE0'];

function Particle({ i }: { i: number }) {
  const p = useSharedValue(0);
  const angle = (i / PARTICLES) * Math.PI * 2;
  const dist = 70 + (i % 3) * 18;
  useEffect(() => {
    p.set(withDelay(180, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.get(),
    transform: [
      { translateX: Math.cos(angle) * dist * p.get() },
      { translateY: Math.sin(angle) * dist * p.get() },
      { scale: 1 - p.get() * 0.4 },
      { rotate: `${p.get() * 180}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: i % 2 ? 8 : 10, height: i % 2 ? 8 : 4, borderRadius: 3, backgroundColor: COLORS[i % COLORS.length] },
        style,
      ]}
    />
  );
}

/** Spring-in check mark with a confetti burst; fires a success haptic. */
export function SaveSuccess({ title, subtitle }: { title: string; subtitle: string }) {
  const { c } = useTheme();
  const ring = useSharedValue(0);
  const check = useSharedValue(0);
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    ring.set(withSpring(1, { damping: 12, stiffness: 140 }));
    check.set(withDelay(160, withSequence(withSpring(1.2, { damping: 8 }), withSpring(1, { damping: 10 }))));
  }, [ring, check]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ring.get() }], opacity: ring.get() }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: check.get() }] }));
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        {Array.from({ length: PARTICLES }).map((_, i) => (
          <Particle key={i} i={i} />
        ))}
        <Animated.View style={[{ width: 104, height: 104, borderRadius: 52, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }, ringStyle]}>
          <Animated.View style={[{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' }, checkStyle]}>
            <Ionicons name="checkmark" size={42} color="#fff" />
          </Animated.View>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(250).duration(DUR.slow).easing(EASE_OUT)} style={{ alignItems: 'center', gap: space.sm }}>
        <T v="title" style={{ textAlign: 'center' }}>
          {title}
        </T>
        <T v="body" color="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
          {subtitle}
        </T>
      </Animated.View>
    </View>
  );
}
