import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, useTheme } from '../theme';
import { T, Tap } from './ui';

export interface SheetAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
            <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(22)}
            exiting={SlideOutDown.duration(180)}
            style={{
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.md,
              paddingHorizontal: space.lg,
            }}
          >
            <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: space.md }} />
            {title && (
              <T v="bodyStrong" color="muted" style={{ textAlign: 'center', marginBottom: space.sm }} numberOfLines={1}>
                {title}
              </T>
            )}
            {actions.map((a) => (
              <Tap
                key={a.label}
                onPress={() => {
                  onClose();
                  setTimeout(a.onPress, 220);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, height: 54, paddingHorizontal: space.sm }}
              >
                <Ionicons name={a.icon} size={22} color={a.destructive ? c.danger : c.text} />
                <T v="body" color={a.destructive ? 'danger' : 'text'}>
                  {a.label}
                </T>
              </Tap>
            ))}
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

/** Generic animated bottom sheet with drag handle; keyboard-aware. */
export function BottomSheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {visible && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
            <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20)}
            exiting={SlideOutDown.duration(180)}
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: space.md,
              paddingBottom: insets.bottom + space.lg,
              maxHeight: '88%',
            }}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, marginBottom: space.md }} />
            {title && (
              <T v="heading" style={{ paddingHorizontal: space.xl, marginBottom: space.md }}>
                {title}
              </T>
            )}
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}
