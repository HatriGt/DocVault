import React from 'react';
import { View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { T, Tap } from './ui';
import { elevation, radius, space, useTheme } from '../theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap, string]> = {
  index: ['home', 'home-outline', 'Home'],
  documents: ['document-text', 'document-text-outline', 'Documents'],
  favorites: ['star', 'star-outline', 'Favorites'],
  settings: ['settings', 'settings-outline', 'Settings'],
};

export const TAB_BAR_HEIGHT = 72;

/** Floating pill tab bar with a tinted capsule behind the active tab. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: space.lg,
          right: space.lg,
          bottom: Math.max(insets.bottom, space.md),
          height: TAB_BAR_HEIGHT,
          borderRadius: radius.xl,
          backgroundColor: c.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: space.sm,
        },
        elevation(c, 3),
      ]}
    >
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const [on, off, label] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline', route.name];
        return (
          <Tap
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={{
              flex: 1,
              height: TAB_BAR_HEIGHT - 16,
              borderRadius: radius.lg,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              backgroundColor: focused ? c.accentSoft : 'transparent',
            }}
          >
            <Ionicons name={focused ? on : off} size={23} color={focused ? c.accent : c.textMuted} />
            <T v="caption" color={focused ? 'accent' : 'muted'} style={{ fontSize: 11.5 }}>
              {label}
            </T>
          </Tap>
        );
      })}
    </View>
  );
}
