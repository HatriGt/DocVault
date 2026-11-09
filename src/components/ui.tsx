import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextInput,
  TextInputProps,
  TextInputInstance,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type, useTheme, elevation, fonts } from '../theme';

type Variant = keyof typeof type;

export function T({
  v = 'body',
  color,
  style,
  ...rest
}: TextProps & { v?: Variant; color?: 'text' | 'muted' | 'faint' | 'accent' | 'danger' | 'success' | 'onAccent' | string }) {
  const { c } = useTheme();
  const map: Record<string, string> = {
    text: c.text,
    muted: c.textMuted,
    faint: c.textFaint,
    accent: c.accent,
    danger: c.danger,
    success: c.success,
    onAccent: c.onAccent,
  };
  return <Text {...rest} style={[type[v], { color: map[color ?? 'text'] ?? color }, style]} />;
}

export function Screen({
  children,
  edges = ['top'],
  style,
}: {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable with a subtle spring scale + light haptic — the app's core micro-interaction. */
export function Tap({
  children,
  style,
  haptic = true,
  scaleTo = 0.97,
  onPress,
  debounce = true,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number; debounce?: boolean; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const last = useRef(0);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, { damping: 15, stiffness: 300 }));
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        // Ignore rapid repeat taps so a double tap can't open a screen twice.
        if (debounce) {
          const now = e.nativeEvent.timestamp || 0;
          if (now && now - last.current < 450) return;
          last.current = now;
        }
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[style, a]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  size = 'lg',
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'lg' | 'md';
}) {
  const { c } = useTheme();
  const bg = { primary: c.accent, secondary: c.surface, ghost: 'transparent', danger: c.dangerSoft }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, ghost: c.text, danger: c.danger }[variant];
  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      style={[
        {
          height: size === 'lg' ? 56 : 44,
          borderRadius: radius.pill,
          backgroundColor: bg,
          paddingHorizontal: space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.4 : 1,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: c.hairline,
        },
        variant === 'primary' && elevation(c, 2),
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={fg} />}
          <T v="bodyStrong" color={fg}>
            {title}
          </T>
        </>
      )}
    </Tap>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tint,
  bg,
  size = 44,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label: string;
  tint?: string;
  bg?: string;
  size?: number;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={8}
      style={{
        opacity: disabled ? 0.35 : 1,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...(bg ? {} : { borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }),
      }}
    >
      <Ionicons name={icon} size={size * 0.45} color={tint ?? c.text} />
    </Tap>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  tint,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
}) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={{
        height: 38,
        paddingHorizontal: icon ? 14 : 16,
        borderRadius: radius.pill,
        backgroundColor: active ? c.accent : c.surface,
        borderWidth: active ? 0 : StyleSheet.hairlineWidth,
        borderColor: c.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon && <Ionicons name={icon} size={15} color={active ? c.onAccent : tint ?? c.textMuted} />}
      <T v="callout" color={active ? c.onAccent : c.text} style={{ fontFamily: fonts.medium }}>
        {label}
      </T>
    </Tap>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.md }}>
      <T v="heading" style={{ fontSize: 18 }}>{title}</T>
      {action && (
        <Tap onPress={onAction} hitSlop={10}>
          <T v="callout" color={c.gold} style={{ fontFamily: fonts.semibold }}>
            {action}
          </T>
        </Tap>
      )}
    </View>
  );
}

export function SearchField({ ref, ...props }: TextInputProps & { trailing?: React.ReactNode; ref?: React.Ref<TextInputInstance> }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        height: 50,
        borderRadius: radius.md,
        backgroundColor: c.surfaceAlt,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        gap: space.sm,
      }}
    >
      <Ionicons name="search" size={19} color={c.textMuted} />
      <TextInput
        ref={ref}
        placeholderTextColor={c.textFaint}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        {...props}
        style={[type.body, { flex: 1, color: c.text, paddingVertical: 0 }]}
      />
      {props.trailing}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color="muted">
        {label}
      </T>
      <TextInput
        placeholderTextColor={c.textFaint}
        {...props}
        style={[
          type.body,
          {
            color: c.text,
            backgroundColor: c.surface,
            borderRadius: radius.md,
            paddingHorizontal: space.lg,
            height: props.multiline ? 96 : 52,
            paddingTop: props.multiline ? space.md : 0,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.border,
          },
          props.style,
        ]}
      />
      {hint && (
        <T v="caption" color="faint">
          {hint}
        </T>
      )}
    </View>
  );
}

/** Grouped list section (iOS Settings / Android preference style). */
export function Group({ children, title, footer }: { children: React.ReactNode; title?: string; footer?: string }) {
  const { c } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ marginBottom: space.xxl }}>
      {title && (
        <T v="overline" color="muted" style={{ marginBottom: space.sm, marginLeft: space.xs, textTransform: 'uppercase' }}>
          {title}
        </T>
      )}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 56 }} />}
            {child}
          </View>
        ))}
      </View>
      {footer && (
        <T v="caption" color="faint" style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
          {footer}
        </T>
      )}
    </View>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  right,
  danger,
  chevron = !!onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  chevron?: boolean;
}) {
  const { c } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, gap: space.md }}>
      {icon && (
        <View style={{ width: 28, alignItems: 'center' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name={icon} size={21} color={danger ? c.danger : c.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, paddingVertical: space.md }}>
        <T v="body" color={danger ? 'danger' : 'text'}>
          {title}
        </T>
        {subtitle && (
          <T v="caption" color="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </T>
        )}
      </View>
      {value && (
        <T v="callout" color="muted" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </T>
      )}
      {right}
      {chevron && (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </View>
      )}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} android_ripple={{ color: c.border }} accessibilityRole="button" accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}>
      {({ pressed }) => <View style={{ opacity: pressed ? 0.6 : 1 }}>{content}</View>}
    </Pressable>
  ) : (
    content
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xxl, gap: space.md }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 24,
          backgroundColor: c.goldSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.sm,
        }}
      >
        <Ionicons name={icon} size={30} color={c.gold} />
      </View>
      <T v="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T v="callout" color="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
        {body}
      </T>
      {action && <Button title={action} onPress={onAction} size="md" style={{ marginTop: space.md }} />}
    </View>
  );
}

export function Banner({
  tone,
  icon,
  text,
  action,
  onAction,
}: {
  tone: 'info' | 'warning' | 'danger' | 'success';
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  const { c } = useTheme();
  const bg = { info: c.accentSoft, warning: c.warningSoft, danger: c.dangerSoft, success: c.successSoft }[tone];
  const fg = { info: c.accent, warning: c.warning, danger: c.danger, success: c.success }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: bg,
        borderRadius: radius.md,
        padding: space.md,
      }}
    >
      <Ionicons name={icon} size={18} color={fg} />
      <T v="callout" style={{ flex: 1 }}>
        {text}
      </T>
      {action && (
        <Tap onPress={onAction} hitSlop={8}>
          <T v="callout" color={fg} style={{ fontFamily: fonts.bold }}>
            {action}
          </T>
        </Tap>
      )}
    </View>
  );
}
