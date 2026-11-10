import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';

/** Soft pastel washes (lavender / peach / butter) behind content — the signature DocVault feel. */
export function Backdrop({ variant = 'home' }: { variant?: 'home' | 'list' | 'detail' }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const blobs =
    variant === 'home'
      ? [
          { color: c.blobA, size: width * 0.95, top: -width * 0.4, left: -width * 0.38, o: 0.7 },
          { color: c.blobB, size: width * 0.7, top: height * 0.3, right: -width * 0.45, o: 0.5 },
          { color: c.blobC, size: width * 0.6, top: height * 0.72, left: -width * 0.35, o: 0.45 },
        ]
      : variant === 'list'
        ? [
            { color: c.blobA, size: width * 0.8, top: -width * 0.45, right: -width * 0.3, o: 0.55 },
            { color: c.blobB, size: width * 0.6, top: height * 0.65, left: -width * 0.4, o: 0.35 },
          ]
        : [
            { color: c.blobA, size: width * 0.85, top: -width * 0.25, right: -width * 0.4, o: 0.7 },
            { color: c.blobB, size: width * 0.6, top: width * 0.25, left: -width * 0.4, o: 0.55 },
            { color: c.blobC, size: width * 0.45, top: width * 0.7, right: -width * 0.15, o: 0.45 },
          ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {blobs.map(({ color, size, o, ...pos }, i) => (
        <View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: o, ...pos }} />
      ))}
    </View>
  );
}
