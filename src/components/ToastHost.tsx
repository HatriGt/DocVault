import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tap } from './ui';
import { elevation, fonts, radius, space, useTheme } from '../theme';
import { onToast, ToastMsg } from '../lib/toast';
import { DUR, EASE_OUT } from '../theme/motion';

/** Bottom toast with optional action (e.g. Undo); auto-dismisses after 4s. */
export function ToastHost() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => onToast(setMsg), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 100, alignItems: 'center' }}>
      <Animated.View
        key={msg.id}
        entering={SlideInDown.duration(DUR.slow).easing(EASE_OUT)}
        exiting={FadeOutDown.duration(180)}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.text, borderRadius: radius.pill, paddingLeft: space.lg, paddingRight: msg.action ? space.sm : space.lg, height: 50, maxWidth: '92%' }, elevation(c, 3)]}
      >
        {msg.icon && <Ionicons name={msg.icon as keyof typeof Ionicons.glyphMap} size={18} color={c.bg} />}
        <T v="callout" color={c.bg} numberOfLines={1} style={{ flexShrink: 1 }}>
          {msg.text}
        </T>
        {msg.action && (
          <Tap
            onPress={() => {
              msg.action!.run();
              setMsg(null);
            }}
            style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: space.lg, height: 36, justifyContent: 'center' }}
          >
            <T v="callout" color="#fff" style={{ fontFamily: fonts.bold }}>
              {msg.action.label}
            </T>
          </Tap>
        )}
      </Animated.View>
    </View>
  );
}
