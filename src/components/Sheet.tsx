import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedKeyboard, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { fonts, radius, space, useTheme } from '../theme';
import { DUR, EASE_OUT } from '../theme/motion';
import { T, Tap } from './ui';

export interface SheetAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  /** Optional group heading; consecutive actions with the same section share one header. */
  section?: string;
  /** Short secondary line under the label. */
  hint?: string;
}

const ENTER = SlideInDown.duration(DUR.slow).easing(EASE_OUT);
const EXIT = SlideOutDown.duration(DUR.fast).easing(Easing.in(Easing.quad));

/**
 * Shared sheet chrome: fading backdrop + sheet gliding up on an ease-out curve
 * (no bounce). The keyboard lifts the sheet frame-by-frame via
 * useAnimatedKeyboard instead of resizing layout, which is what caused jitter.
 */
function SheetFrame({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Keep the Modal mounted until the exit animation has played.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible || !mounted) return;
    const t = setTimeout(() => setMounted(false), DUR.fast + 40);
    return () => clearTimeout(t);
  }, [visible, mounted]);
  const kb = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true, isNavigationBarTranslucentAndroid: true });
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -kb.height.get() }] }));
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {visible && (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(DUR.base)} exiting={FadeOut.duration(DUR.fast)} style={StyleSheet.absoluteFill}>
            <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View style={lift}>
            <Animated.View
              entering={ENTER}
              exiting={EXIT}
              style={{
                backgroundColor: c.bg,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingTop: space.md,
                paddingBottom: insets.bottom + space.lg,
                maxHeight: height - insets.top - 24,
              }}
            >
              <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.hairline, marginBottom: space.md }} />
              {children}
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

export function ActionSheet({ visible, onClose, title, actions }: { visible: boolean; onClose: () => void; title?: string; actions: SheetAction[] }) {
  const { c } = useTheme();
  return (
    <SheetFrame visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: space.lg }}>
        {title && (
          <T v="bodyStrong" color="muted" style={{ textAlign: 'center', marginBottom: space.sm }} numberOfLines={1}>
            {title}
          </T>
        )}
        {actions.map((a, i) => (
          <React.Fragment key={a.label}>
          {a.section && a.section !== actions[i - 1]?.section && (
            <T v="caption" color="faint" style={{ marginTop: i ? space.md : 0, marginBottom: 2, paddingHorizontal: space.sm, fontFamily: fonts.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {a.section}
            </T>
          )}
          <Tap
            scaleTo={0.985}
            onPress={() => {
              onClose();
              // Run after the sheet has left so the next screen/sheet doesn't overlap it.
              setTimeout(a.onPress, DUR.fast + 40);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, minHeight: a.hint ? 60 : 52, paddingHorizontal: space.sm }}
          >
            <Ionicons name={a.icon} size={22} color={a.destructive ? c.danger : c.text} />
            <View style={{ flex: 1 }}>
              <T v="body" color={a.destructive ? 'danger' : 'text'}>
                {a.label}
              </T>
              {!!a.hint && (
                <T v="caption" color="muted" numberOfLines={1}>
                  {a.hint}
                </T>
              )}
            </View>
          </Tap>
          </React.Fragment>
        ))}
      </View>
    </SheetFrame>
  );
}

/** Generic animated bottom sheet with drag handle; keyboard-aware without layout jumps. */
export function BottomSheet({
  visible,
  onClose,
  children,
  title,
  action,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Primary action in the header, so it stays visible above the keyboard. */
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const { c } = useTheme();
  return (
    <SheetFrame visible={visible} onClose={onClose}>
      {(title || action) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.md, minHeight: 40 }}>
          <T v="heading" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </T>
          {action && (
            <Tap
              onPress={action.onPress}
              disabled={action.disabled}
              accessibilityLabel={action.label}
              style={{ height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: action.disabled ? c.surfaceAlt : c.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <T v="bodyStrong" color={action.disabled ? c.textFaint : '#fff'}>
                {action.label}
              </T>
            </Tap>
          )}
        </View>
      )}
      {children}
    </SheetFrame>
  );
}
