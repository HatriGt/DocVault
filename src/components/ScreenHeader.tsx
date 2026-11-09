import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T } from './ui';
import { space } from '../theme';

type Leading = 'back' | 'close' | 'none';

export interface ScreenHeaderProps {
  title?: string;
  /** Page variant only: a line of context under the title. */
  subtitle?: string;
  /**
   * `page`: navigation row, then a large title (pushed screens).
   * `modal`: one slim bar with a centred title (tasks presented over the app: add, edit…).
   */
  variant?: 'page' | 'modal';
  leading?: Leading;
  /** Defaults to router.back(). */
  onLeading?: () => void;
  /** Optional action on the right of the navigation row (an IconButton, usually). */
  right?: React.ReactNode;
  /** Pad for the status bar; set when the header is rendered by a navigator, not inside a Screen. */
  safeTop?: boolean;
}

const BUTTON = 44;

/** The one header used by every non-tab screen, so navigation looks and behaves the same everywhere. */
export function ScreenHeader({ title, subtitle, variant = 'page', leading = 'back', onLeading, right, safeTop }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const leadingButton =
    leading === 'none' ? (
      <View style={{ width: BUTTON }} />
    ) : (
      <IconButton icon={leading === 'close' ? 'close' : 'chevron-back'} label={leading === 'close' ? 'Close' : 'Back'} onPress={onLeading ?? (() => router.back())} />
    );
  const trailing = right ?? <View style={{ width: BUTTON }} />;
  const top = safeTop ? insets.top : 0;

  if (variant === 'modal') {
    return (
      <View style={{ paddingTop: top, paddingHorizontal: space.xl }}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {leadingButton}
          <T v="bodyStrong" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: space.sm }}>
            {title}
          </T>
          {trailing}
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: top + space.sm, paddingHorizontal: space.xl, paddingBottom: title ? space.lg : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {leadingButton}
        {trailing}
      </View>
      {!!title && (
        <T v="title" style={{ marginTop: space.lg }} accessibilityRole="header">
          {title}
        </T>
      )}
      {!!subtitle && (
        <T v="callout" color="muted" style={{ marginTop: 4 }}>
          {subtitle}
        </T>
      )}
    </View>
  );
}
