import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from './ui';
import { radius, space, useTheme } from '../theme';
import { useActivity } from '../lib/hooks';
import { relativeTime } from '../lib/format';
import type { ActivityKind } from '../lib/activity';

const META: Record<ActivityKind, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  added: { icon: 'add-circle-outline', label: 'Added to vault' },
  opened: { icon: 'eye-outline', label: 'Opened' },
  shared: { icon: 'share-outline', label: 'Shared' },
  edited: { icon: 'create-outline', label: 'Edited' },
  moved: { icon: 'folder-open-outline', label: 'Moved' },
  exported: { icon: 'download-outline', label: 'Saved a copy' },
  synced: { icon: 'cloud-done-outline', label: 'Backed up' },
};

/** Private on-device timeline of what happened to a document. */
export function ActivityList({ docId }: { docId: string }) {
  const { c } = useTheme();
  const items = useActivity(docId);
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: space.xxl }}>
      <T v="overline" color="muted" style={{ marginBottom: space.sm, marginLeft: space.xs }}>
        ACTIVITY · ONLY ON THIS DEVICE
      </T>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
        {items.slice(0, 8).map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: space.md, paddingVertical: 10 }}>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={META[a.kind]?.icon ?? 'ellipse-outline'} size={18} color={i === 0 ? c.gold : c.textMuted} />
              {i < Math.min(items.length, 8) - 1 && <View style={{ flex: 1, width: 1, backgroundColor: c.hairline, marginTop: 4 }} />}
            </View>
            <View style={{ flex: 1 }}>
              <T v="callout">
                {META[a.kind]?.label ?? a.kind}
                {a.detail ? <T v="callout" color="muted">{` · ${a.detail}`}</T> : null}
              </T>
              <T v="caption" color="faint">
                {relativeTime(a.at)}
              </T>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
