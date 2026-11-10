import React from 'react';
import { useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Animated, { makeMutable, useSharedValue } from 'react-native-reanimated';

/**
 * Set to 1 while a touch is on a horizontal scroller (carousel, chip row, folder strip), so a
 * horizontal fling there scrolls that list instead of switching tabs. Read on the UI thread.
 */
export const tabSwipeVeto = makeMutable(0);
const vetoProps = {
  onTouchStart: () => tabSwipeVeto.set(1),
  onTouchEnd: () => tabSwipeVeto.set(0),
  onTouchCancel: () => tabSwipeVeto.set(0),
};
/** Spread onto any horizontal ScrollView inside a tab screen. */
export const noTabSwipe = vetoProps;

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

  const vetoed = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onStart(() => {
      vetoed.set(tabSwipeVeto.get()); // touch began on a horizontal scroller
    })
    .onEnd((e) => {
      if (vetoed.get()) return;
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
