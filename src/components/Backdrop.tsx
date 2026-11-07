import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

/** A single, very soft warm wash at the top of the screen — no decorative blobs. */
export function Backdrop({ variant = 'home' }: { variant?: 'home' | 'list' | 'detail' }) {
  const { c } = useTheme();
  if (variant !== 'home') return null;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: '70%', backgroundColor: c.goldSoft, opacity: 0.35 }]} />;
}
