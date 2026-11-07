import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { T, Tap } from './ui';
import { elevation, radius, space, useTheme } from '../theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  index: ['home', 'home-outline', 'Home'],
  documents: ['albums', 'albums-outline', 'Library'],
  favorites: ['wallet', 'wallet-outline', 'Wallet'],
  settings: ['person-circle', 'person-circle-outline', 'You'],
};

export const TAB_BAR_HEIGHT = 68;

function TabItem({ name, focused, onPress }: { name: string; focused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [on, off, label] = ICONS[name] ?? ['ellipse', 'ellipse-outline', name];
  const dot = useAnimatedStyle(() => ({ opacity: withSpring(focused ? 1 : 0), transform: [{ scale: withSpring(focused ? 1 : 0.4) }] }));
  return (
    <Tap accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} onPress={onPress} style={{ flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Ionicons name={focused ? on : off} size={22} color={focused ? c.accent : c.textFaint} />
      <T v="caption" color={focused ? c.accent : c.textMuted} style={{ fontSize: 11 }}>
        {label}
      </T>
      <Animated.View style={[{ position: 'absolute', bottom: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent }, dot]} />
    </Tap>
  );
}

/** Floating graphite dock with a raised champagne "+" in the centre. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const items = state.routes.map((route, i) => (
    <TabItem key={route.key} name={route.name} focused={state.index === i} onPress={() => state.index !== i && navigateToTab(route.key)} />
  ));
  return (
    <View style={[{ position: 'absolute', left: space.lg, right: space.lg, bottom: Math.max(insets.bottom, space.md), height: TAB_BAR_HEIGHT, borderRadius: radius.xl, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm }, elevation(c, 3)]}>
      {items.slice(0, 2)}
      <View style={{ width: 72, alignItems: 'center' }}>
        <Tap
          onPress={() => router.push('/add')}
          accessibilityLabel="Add document"
          style={[{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, borderColor: c.bg }, elevation(c, 2)]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Tap>
      </View>
      {items.slice(2)}
    </View>
  );
}
