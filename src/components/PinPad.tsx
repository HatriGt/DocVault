import React from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { T, Tap } from './ui';
import { space, useTheme } from '../theme';

export const PIN_LENGTH = 6;

/** Filled/empty dots for the digits entered so far. `style` takes an animated style (e.g. a shake). */
export function PinDots({ count, style }: { count: number; style?: React.ComponentProps<typeof Animated.View>['style'] }) {
  const { c } = useTheme();
  return (
    <Animated.View style={[{ flexDirection: 'row', gap: space.md }, style]} accessibilityLabel={`${count} of ${PIN_LENGTH} digits entered`}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < count ? c.accent : c.surfaceAlt }} />
      ))}
    </Animated.View>
  );
}

/**
 * The one PIN keypad (set-up and lock screen). Keys scale with the screen height so the whole pad,
 * including 0 and delete, fits on short phones.
 */
export function PinPad({
  onDigit,
  onDelete,
  extraKey,
  disabled,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  /** Optional bottom-left key, e.g. "use biometrics". */
  extraKey?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const size = Math.round(Math.max(56, Math.min(76, height * 0.085)));
  const gap = size > 66 ? space.lg : space.md;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'del'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: size * 3 + gap * 2, gap, justifyContent: 'center' }}>
      {keys.map((k) => {
        const blank = k === 'extra' && !extraKey;
        const digit = k !== 'extra' && k !== 'del';
        return (
          <Tap
            key={k}
            debounce={false}
            disabled={blank || disabled}
            accessibilityLabel={k === 'del' ? 'Delete' : k === 'extra' ? extraKey?.label : k}
            onPress={() => (k === 'del' ? onDelete() : k === 'extra' ? extraKey?.onPress() : onDigit(k))}
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: digit ? c.surface : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: disabled && digit ? 0.5 : 1 }}
          >
            {k === 'del' ? (
              <Ionicons name="backspace-outline" size={26} color={c.text} />
            ) : k === 'extra' ? (
              extraKey ? <Ionicons name={extraKey.icon} size={28} color={c.accent} /> : null
            ) : (
              <T v="title">{k}</T>
            )}
          </Tap>
        );
      })}
    </View>
  );
}
