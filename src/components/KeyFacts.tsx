import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T, Tap } from './ui';
import { radius, space, useTheme } from '../theme';

export interface KeyFact {
  label: string;
  value: string;
  /** Second line, e.g. "in 61 days". */
  note?: string;
  tone?: 'default' | 'warning' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** The two or three facts people open a document for, shown above the fold as compact tiles. */
export function KeyFacts({ facts }: { facts: KeyFact[] }) {
  const { c } = useTheme();
  if (!facts.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {facts.map((f) => {
        const tint = f.tone === 'danger' ? c.danger : f.tone === 'warning' ? c.warning : c.text;
        return (
          <Tap
            key={f.label}
            onPress={f.onPress}
            disabled={!f.onPress}
            scaleTo={0.97}
            accessibilityLabel={f.accessibilityLabel ?? `${f.label}: ${f.value}${f.note ? `, ${f.note}` : ''}`}
            style={{ flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="caption" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {f.label}
              </T>
              {f.icon && <Ionicons name={f.icon} size={13} color={c.textFaint} />}
            </View>
            <T v="bodyStrong" color={tint} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 2 }}>
              {f.value}
            </T>
            {!!f.note && (
              <T v="caption" color={f.tone === 'danger' ? 'danger' : 'muted'} numberOfLines={1}>
                {f.note}
              </T>
            )}
          </Tap>
        );
      })}
    </View>
  );
}
