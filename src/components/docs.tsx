import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { T, Tap } from './ui';
import { radius, space, useTheme, elevation } from '../theme';
import type { DocRecord } from '../lib/db';
import { BUILTIN_CATEGORIES, CARD_TYPES } from '../lib/categories';
import { parseFields } from '../lib/documents';
import { daysUntil, formatBytes, formatDate, maskNumber } from '../lib/format';

export const categoryOf = (id: string) => BUILTIN_CATEGORIES.find((c) => c.id === id);
export const hueFor = (doc: DocRecord) => categoryOf(doc.category)?.hue ?? '#7A7480';

// ---------- Sync state ----------
type BadgeSpec = { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'success' | 'muted' | 'accent' | 'warning' | 'danger' };

export function syncSpec(doc: DocRecord): BadgeSpec {
  switch (doc.sync_state) {
    case 'syncing':
      return { label: 'Syncing', icon: 'sync', tone: 'accent' };
    case 'upload_pending':
      return { label: 'Upload pending', icon: 'cloud-upload-outline', tone: 'warning' };
    case 'download_pending':
      return { label: 'Downloading', icon: 'cloud-download-outline', tone: 'accent' };
    case 'failed':
      return { label: 'Sync failed', icon: 'alert-circle', tone: 'danger' };
    case 'local_only':
      return { label: 'On this device', icon: 'phone-portrait-outline', tone: 'muted' };
    default:
      return doc.has_local
        ? { label: 'Offline', icon: 'checkmark-circle', tone: 'success' }
        : { label: 'Cloud only', icon: 'cloud-outline', tone: 'muted' };
  }
}

export function SyncBadge({ doc, compact }: { doc: DocRecord; compact?: boolean }) {
  const { c } = useTheme();
  const s = syncSpec(doc);
  const fg = { success: c.success, muted: c.textMuted, accent: c.accent, warning: c.warning, danger: c.danger }[s.tone];
  const bg = { success: c.successSoft, muted: c.surfaceAlt, accent: c.accentSoft, warning: c.warningSoft, danger: c.dangerSoft }[s.tone];
  return (
    <View
      accessibilityLabel={s.label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: compact ? 0 : 10,
        height: compact ? undefined : 26,
        borderRadius: radius.pill,
        backgroundColor: compact ? 'transparent' : bg,
      }}
    >
      <Ionicons name={s.icon} size={compact ? 14 : 15} color={fg} />
      {!compact && (
        <T v="caption" color={fg} style={{ fontWeight: '600' }}>
          {s.label}
        </T>
      )}
    </View>
  );
}

// ---------- Wallet card ----------
const CARD_SKINS: Record<string, { bg: string; fg: string; sub: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Passport: { bg: '#1E2A5A', fg: '#E9C46A', sub: 'rgba(233,196,106,0.75)', icon: 'globe-outline' },
  Visa: { bg: '#0F4C5C', fg: '#F1F5F4', sub: 'rgba(241,245,244,0.7)', icon: 'airplane-outline' },
  'Credit Card': { bg: '#17161A', fg: '#F3F2EF', sub: 'rgba(243,242,239,0.6)', icon: 'card-outline' },
  'Boarding Pass': { bg: '#2F8FDB', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.75)', icon: 'airplane' },
};
const DEFAULT_SKIN = { bg: '#F2F0FB', fg: '#1F1B3A', sub: '#6E6890', icon: 'id-card-outline' as const };

export function WalletCard({
  doc,
  side = 'front',
  width,
  style,
}: {
  doc: DocRecord;
  side?: 'front' | 'back';
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const f = parseFields(doc);
  const skin = CARD_SKINS[doc.doc_type ?? ''] ?? DEFAULT_SKIN;
  const h = width / 1.586; // ISO/IEC 7810 ID-1 ratio
  const scale = width / 340;
  const days = daysUntil(doc.expiry);
  const expiring = days != null && days <= 90;

  return (
    <View
      style={[
        {
          width,
          height: h,
          borderRadius: 18 * scale,
          backgroundColor: skin.bg,
          padding: 18 * scale,
          overflow: 'hidden',
          justifyContent: 'space-between',
        },
        elevation(c, 2),
        style,
      ]}
    >
      {/* subtle guilloché-style ornament */}
      <View
        style={{
          position: 'absolute',
          right: -60 * scale,
          top: -60 * scale,
          width: 200 * scale,
          height: 200 * scale,
          borderRadius: 100 * scale,
          borderWidth: 26 * scale,
          borderColor: skin.fg,
          opacity: 0.06,
        }}
      />
      {side === 'front' ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T v="overline" color={skin.sub} style={{ fontSize: 10 * scale, textTransform: 'uppercase' }} numberOfLines={1}>
                {f.issuer ?? f.country ?? doc.doc_type ?? 'Document'}
              </T>
              <T v="heading" color={skin.fg} style={{ fontSize: 19 * scale, lineHeight: 24 * scale, marginTop: 2 }} numberOfLines={1}>
                {doc.name}
              </T>
            </View>
            <Ionicons name={skin.icon} size={30 * scale} color={skin.fg} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              {f.holder ? (
                <T v="bodyStrong" color={skin.fg} style={{ fontSize: 15 * scale }} numberOfLines={1}>
                  {f.holder}
                </T>
              ) : null}
              {f.number ? (
                <T v="mono" color={skin.sub} style={{ fontSize: 13 * scale, marginTop: 2 }}>
                  {maskNumber(f.number)}
                </T>
              ) : null}
            </View>
            {doc.expiry && (
              <View style={{ alignItems: 'flex-end' }}>
                <T v="overline" color={expiring ? '#FF8A8A' : skin.sub} style={{ fontSize: 9 * scale }}>
                  {expiring ? 'EXPIRES SOON' : 'VALID UNTIL'}
                </T>
                <T v="caption" color={skin.fg} style={{ fontSize: 12 * scale }}>
                  {formatDate(doc.expiry)}
                </T>
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={{ height: 34 * scale, backgroundColor: skin.fg, opacity: 0.85, marginHorizontal: -18 * scale, marginTop: 6 * scale }} />
          <View style={{ gap: 4 * scale }}>
            {[
              ['Number', f.number],
              ['Country', f.country],
              ['Issued by', f.issuer],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="caption" color={skin.sub} style={{ fontSize: 11 * scale }}>
                    {k}
                  </T>
                  <T v="caption" color={skin.fg} style={{ fontSize: 11 * scale }} numberOfLines={1}>
                    {v}
                  </T>
                </View>
              ))}
          </View>
          <T v="mono" color={skin.sub} style={{ fontSize: 9 * scale, letterSpacing: 2 }} numberOfLines={1}>
            {`P<${(f.country ?? 'XXX').slice(0, 3).toUpperCase()}<${(f.holder ?? '').toUpperCase().replace(/\s+/g, '<')}<<<<<<<<<<<`}
          </T>
        </>
      )}
    </View>
  );
}

// ---------- Thumbnail (mini document page) ----------
export function DocThumb({ doc, size = 56 }: { doc: DocRecord; size?: number }) {
  const { c } = useTheme();
  const hue = hueFor(doc);
  if (CARD_TYPES.has(doc.doc_type ?? '')) {
    const skin = CARD_SKINS[doc.doc_type ?? ''] ?? { ...DEFAULT_SKIN, bg: hue + '22', fg: hue };
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: skin.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={skin.icon} size={size * 0.42} color={skin.fg} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.56,
          height: size * 0.72,
          borderRadius: 4,
          backgroundColor: c.surface,
          padding: size * 0.07,
          gap: size * 0.05,
          ...elevation(c, 1),
        }}
      >
        <View style={{ height: size * 0.06, width: '70%', backgroundColor: hue, borderRadius: 2 }} />
        {[1, 0.8, 0.9, 0.6].map((w, i) => (
          <View key={i} style={{ height: size * 0.035, width: `${w * 100}%`, backgroundColor: c.border, borderRadius: 2 }} />
        ))}
      </View>
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          paddingHorizontal: 4,
          borderRadius: 4,
          backgroundColor: hue,
        }}
      >
        <T v="overline" color="#fff" style={{ fontSize: 8, lineHeight: 12 }}>
          {doc.ext.toUpperCase()}
        </T>
      </View>
    </View>
  );
}

// ---------- List row ----------
export function DocRow({ doc, onMore }: { doc: DocRecord; onMore?: (d: DocRecord) => void }) {
  const { c } = useTheme();
  const cat = categoryOf(doc.category);
  return (
    <Tap
      onPress={() => router.push(`/doc/${doc.id}`)}
      accessibilityLabel={`${doc.name}, ${cat?.name ?? doc.category}, ${syncSpec(doc).label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
      }}
    >
      <DocThumb doc={doc} />
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {doc.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <T v="caption" color="muted">
            {cat?.name ?? doc.category} · {formatBytes(doc.size)}
          </T>
          <SyncBadge doc={doc} compact />
        </View>
      </View>
      {onMore && (
        <Tap onPress={() => onMore(doc)} hitSlop={12} accessibilityLabel={`More actions for ${doc.name}`}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.textMuted} />
        </Tap>
      )}
    </Tap>
  );
}

// ---------- Grid tile ----------
export function DocTile({ doc, width }: { doc: DocRecord; width: number }) {
  const { c } = useTheme();
  const isCard = CARD_TYPES.has(doc.doc_type ?? '');
  return (
    <Tap onPress={() => router.push(`/doc/${doc.id}`)} style={{ width }} accessibilityLabel={doc.name}>
      <View
        style={{
          height: width * 0.8,
          borderRadius: radius.lg,
          backgroundColor: c.surface,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          overflow: 'hidden',
        }}
      >
        {isCard ? <WalletCard doc={doc} width={width * 0.82} /> : <DocThumb doc={doc} size={width * 0.55} />}
        <View style={{ position: 'absolute', top: 8, right: 8 }}>
          <SyncBadge doc={doc} compact />
        </View>
      </View>
      <T v="bodyStrong" numberOfLines={1} style={{ marginTop: space.sm, fontSize: 15 }}>
        {doc.name}
      </T>
      <T v="caption" color="muted">
        {categoryOf(doc.category)?.name ?? doc.category} · {formatBytes(doc.size)}
      </T>
    </Tap>
  );
}
