import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';

/** Soft pastel blobs behind content (lavender / peach / butter), as in the design. */
export function Backdrop({ variant = 'home' }: { variant?: 'home' | 'list' | 'detail' }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const blobs =
    variant === 'home'
      ? [
          { color: c.blobA, size: width * 0.9, top: -width * 0.35, left: -width * 0.4, o: 0.75 },
          { color: c.blobB, size: width * 0.7, top: height * 0.22, right: -width * 0.45, o: 0.6 },
          { color: c.blobC, size: width * 0.6, bottom: -width * 0.25, left: -width * 0.3, o: 0.55 },
        ]
      : variant === 'list'
        ? [
            { color: c.blobA, size: width * 0.8, bottom: -width * 0.35, right: -width * 0.3, o: 0.6 },
            { color: c.blobB, size: width * 0.55, top: -width * 0.3, right: -width * 0.25, o: 0.35 },
          ]
        : [
            { color: c.blobA, size: width * 0.85, top: height * 0.05, right: -width * 0.45, o: 0.6 },
            { color: c.blobB, size: width * 0.6, top: height * 0.18, left: -width * 0.4, o: 0.5 },
            { color: c.blobC, size: width * 0.5, bottom: -width * 0.2, right: -width * 0.25, o: 0.45 },
          ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {blobs.map((b, i) => {
        const { color, size, o, ...pos } = b;
        return <View key={i} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: o, ...pos }} />;
      })}
    </View>
  );
}
