import React from 'react';
import { View } from 'react-native';
import { T } from './ui';
import { fonts, useTheme } from '../theme';

/** Days-left badge: tinted disc with a status ring (green > 30d, amber ≤ 30d, red expired). */
export function CountdownRing({ days, size = 46 }: { days: number; size?: number }) {
  const { c } = useTheme();
  const color = days < 0 ? c.danger : days <= 30 ? c.warning : c.success;
  const soft = days < 0 ? c.dangerSoft : days <= 30 ? c.warningSoft : c.successSoft;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: color, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
      <T v="caption" style={{ fontFamily: fonts.bold, fontSize: size * 0.3, lineHeight: size * 0.34, color }}>
        {days < 0 ? '!' : days > 999 ? '∞' : days}
      </T>
      {days >= 0 && (
        <T v="caption" style={{ fontSize: size * 0.17, lineHeight: size * 0.2, color }}>
          days
        </T>
      )}
    </View>
  );
}
