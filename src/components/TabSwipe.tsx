import React from 'react';
import { useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';

/** Tab order — must match the Tabs layout. */
export const TAB_ROUTES = ['/', '/documents', '/favorites', '/settings'] as const;
const HREF = ['/(tabs)', '/(tabs)/documents', '/(tabs)/favorites', '/(tabs)/settings'] as const;

/**
 * Horizontal fling between tabs. Activates only on a clearly horizontal pan,
 * fails on vertical movement (so lists scroll normally), and lets inner
 * horizontal gestures (swipe rows, carousels) win where they apply.
 */
export function TabSwipe({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const path = usePathname();
  const index = Math.max(0, TAB_ROUTES.indexOf((path === '' ? '/' : path) as (typeof TAB_ROUTES)[number]));

  const go = (dir: 1 | -1) => {
    const next = index + dir;
    if (next < 0 || next >= HREF.length) return;
    Haptics.selectionAsync().catch(() => {});
    router.navigate(HREF[next]);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > width * 0.26;
      const fast = Math.abs(e.velocityX) > 650;
      if (!far && !fast) return;
      runOnJS(go)(e.translationX < 0 ? 1 : -1);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ flex: 1 }}>{children}</Animated.View>
    </GestureDetector>
  );
}
