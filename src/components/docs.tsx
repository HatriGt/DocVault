import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { T, Tap } from './ui';
import { radius, space, useTheme, elevation, fonts } from '../theme';
import type { DocRecord } from '../lib/db';
import { BUILTIN_CATEGORIES, CARD_TYPES } from '../lib/categories';
import { parseFields, parseTags } from '../lib/documents';
import { daysUntil, formatBytes, formatDate, maskNumber } from '../lib/format';

export const categoryOf = (id: string) => BUILTIN_CATEGORIES.find((c) => c.id === id);
export const hueFor = (doc: DocRecord) => categoryOf(doc.category)?.hue ?? '#7A7480';

// ---------- Sync state ----------
type BadgeSpec = { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'success' | 'muted' | 'accent' | 'warning' | 'danger' };

export function syncSpec(doc: DocRecord): BadgeSpec {
  switch (doc.sync_state) {
    case 'syncing':
      return { label: 'Backing up', icon: 'sync', tone: 'accent' };
    case 'upload_pending':
      return { label: 'Waiting to back up', icon: 'cloud-upload-outline', tone: 'warning' };
    case 'download_pending':
      return { label: 'Downloading', icon: 'cloud-download-outline', tone: 'accent' };
    case 'failed':
      return { label: 'Backup failed', icon: 'alert-circle', tone: 'danger' };
    case 'local_only':
      return { label: 'This phone only', icon: 'phone-portrait-outline', tone: 'muted' };
    default:
      return doc.has_local
        ? { label: 'On this phone', icon: 'checkmark-circle', tone: 'success' }
        : { label: 'Drive only', icon: 'cloud-outline', tone: 'muted' };
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
        backgroundColor: compact || s.tone === 'muted' ? 'transparent' : bg,
      }}
    >
      <Ionicons name={s.icon} size={compact ? 14 : 15} color={fg} />
      {!compact && (
        <T v="caption" color={fg} style={{ fontFamily: fonts.semibold }}>
          {s.label}
        </T>
      )}
    </View>
  );
}

// ---------- Wallet card ----------
const CARD_SKINS: Record<string, { bg: string; fg: string; sub: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Passport: { bg: '#23307A', fg: '#F2C14E', sub: 'rgba(242,193,78,0.78)', icon: 'globe-outline' },
  'National ID': { bg: '#E4F1FF', fg: '#16233A', sub: '#4E5D77', icon: 'id-card-outline' },
  'Driving Licence': { bg: '#FCE8F5', fg: '#2A1630', sub: '#7A5A74', icon: 'car-sport-outline' },
  'Residence Permit': { bg: '#E5F6EC', fg: '#13291F', sub: '#466556', icon: 'home-outline' },
  Visa: { bg: '#0F4C5C', fg: '#F1F5F4', sub: 'rgba(241,245,244,0.72)', icon: 'airplane-outline' },
  Aadhaar: { bg: '#FFF1DE', fg: '#2B1E0E', sub: '#7A6342', icon: 'finger-print-outline' },
  'PAN Card': { bg: '#E8ECFF', fg: '#171E3D', sub: '#545D82', icon: 'card-outline' },
  'Credit Card': { bg: '#16132D', fg: '#F4F2FF', sub: 'rgba(244,242,255,0.6)', icon: 'card-outline' },
  'Boarding Pass': { bg: '#3A6FD8', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.75)', icon: 'airplane' },
};
const DEFAULT_SKIN = { bg: '#ECE9FE', fg: '#16132D', sub: '#57536E', icon: 'id-card-outline' as const };

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
          borderWidth: 30 * scale,
          borderColor: skin.fg,
          opacity: 0.07,
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
const FORMAT_TINT: Record<string, string> = {
  pdf: '#C2413A', doc: '#2B5FD9', docx: '#2B5FD9', xls: '#2F7D5B', xlsx: '#2F7D5B', csv: '#2F7D5B', ppt: '#C8642B', pptx: '#C8642B',
  jpg: '#8A6A3F', jpeg: '#8A6A3F', png: '#8A6A3F', heic: '#8A6A3F', webp: '#8A6A3F', mp4: '#5B5F97', mov: '#5B5F97', mp3: '#7A4F86', m4a: '#7A4F86',
};

export function DocThumb({ doc, size = 56 }: { doc: DocRecord; size?: number }) {
  const { c } = useTheme();
  if (CARD_TYPES.has(doc.doc_type ?? '')) {
    const skin = CARD_SKINS[doc.doc_type ?? ''] ?? DEFAULT_SKIN;
    return (
      <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: skin.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={skin.icon} size={size * 0.42} color={skin.fg} />
      </View>
    );
  }
  const tint = FORMAT_TINT[doc.ext] ?? c.textMuted;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.5, height: size * 0.62, borderRadius: 4, backgroundColor: c.surface, padding: size * 0.07, gap: size * 0.045, ...elevation(c, 1) }}>
        {[0.7, 1, 0.85, 0.6].map((w, i) => (
          <View key={i} style={{ height: size * 0.035, width: `${w * 100}%`, backgroundColor: i === 0 ? tint : c.border, borderRadius: 2 }} />
        ))}
      </View>
      <View style={{ position: 'absolute', bottom: size * 0.08, paddingHorizontal: 4, borderRadius: 4, backgroundColor: tint }}>
        <T v="overline" color="#fff" style={{ fontSize: Math.max(7, size * 0.13), lineHeight: Math.max(10, size * 0.19), letterSpacing: 0.4 }}>
          {doc.ext.toUpperCase().slice(0, 4)}
        </T>
      </View>
    </View>
  );
}

// ---------- List row ----------
export function StatusDot({ doc }: { doc: DocRecord }) {
  const { c } = useTheme();
  const sp = syncSpec(doc);
  const color = { success: c.success, muted: c.textFaint, accent: c.gold, warning: c.warning, danger: c.danger }[sp.tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <T v="caption" color="muted">
        {sp.label}
      </T>
    </View>
  );
}

export function DocRow({ doc, onMore, selected, onPress, onLongPress }: { doc: DocRecord; onMore?: (d: DocRecord) => void; selected?: boolean; onPress?: () => void; onLongPress?: () => void }) {
  const { c } = useTheme();
  const cat = categoryOf(doc.category);
  const tags = parseTags(doc);
  const days = daysUntil(doc.expiry);
  return (
    <Tap
      onPress={onPress ?? (() => router.push(`/doc/${doc.id}`))}
      onLongPress={onLongPress}
      scaleTo={0.985}
      accessibilityLabel={`${doc.name}, ${cat?.name ?? doc.category}, ${syncSpec(doc).label}`}
      accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline }}
    >
      {selected !== undefined && (
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: selected ? 0 : 1.5, borderColor: c.textFaint, backgroundColor: selected ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <Ionicons name="checkmark" size={15} color={c.onAccent} />}
        </View>
      )}
      <DocThumb doc={doc} size={48} />
      <View style={{ flex: 1, gap: 3 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {doc.name}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <T v="caption" color="muted">
            {cat?.name ?? doc.category} · {formatBytes(doc.size)}
          </T>
          <StatusDot doc={doc} />
          {days != null && days <= 60 && (
            <T v="caption" color={days < 0 ? c.danger : c.warning}>
              {days < 0 ? 'Expired' : `${days}d left`}
            </T>
          )}
        </View>
        {tags.length > 0 && (
          <T v="caption" color={c.gold} numberOfLines={1}>
            {tags.map((t) => `#${t}`).join('  ')}
          </T>
        )}
      </View>
      {onMore && selected === undefined && (
        <Tap onPress={() => onMore(doc)} hitSlop={12} accessibilityLabel={`More actions for ${doc.name}`}>
          <Ionicons name="ellipsis-horizontal" size={18} color={c.textFaint} />
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

// ---------- Passport booklet (detail hero) ----------
/** Portrait passport booklet: navy cover, gold lettering, emblem and e-passport chip. */
export function PassportBook({ doc, width }: { doc: DocRecord; width: number }) {
  const { c } = useTheme();
  const f = parseFields(doc);
  const h = width * 1.4;
  const gold = '#F2C14E';
  const country = (f.country ?? f.issuer ?? '').toUpperCase();
  return (
    <View
      style={[
        {
          width,
          height: h,
          borderRadius: width * 0.07,
          backgroundColor: '#23307A',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: h * 0.08,
          paddingHorizontal: width * 0.1,
          borderLeftWidth: width * 0.05,
          borderLeftColor: '#1B2563',
        },
        elevation(c, 3),
      ]}
    >
      <T v="overline" color={gold} style={{ fontSize: width * 0.065, lineHeight: width * 0.085, textAlign: 'center' }} numberOfLines={2}>
        {country ? (country.startsWith('REPUBLIC') ? country : `REPUBLIC OF ${country}`) : 'TRAVEL DOCUMENT'}
      </T>
      <View style={{ width: width * 0.38, height: width * 0.38, borderRadius: width * 0.19, borderWidth: 2, borderColor: gold, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="globe-outline" size={width * 0.24} color={gold} />
      </View>
      <View style={{ alignItems: 'center', gap: width * 0.04 }}>
        <T v="heading" color={gold} style={{ fontSize: width * 0.11, lineHeight: width * 0.13, letterSpacing: 2 }}>
          PASSPORT
        </T>
        <View style={{ width: width * 0.16, height: width * 0.1, borderRadius: 3, borderWidth: 2, borderColor: gold, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: width * 0.06, height: width * 0.06, borderRadius: width * 0.03, borderWidth: 1.5, borderColor: gold }} />
        </View>
      </View>
    </View>
  );
}

// ---------- Essentials card (home carousel) ----------
export function EssentialCard({ doc, width }: { doc: DocRecord; width: number }) {
  if (CARD_TYPES.has(doc.doc_type ?? '')) return <WalletCard doc={doc} width={width} />;
  return <FileCard doc={doc} width={width} />;
}

/** Non-card documents in the wallet carousel: paper-like card with format accent. */
function FileCard({ doc, width }: { doc: DocRecord; width: number }) {
  const { c } = useTheme();
  const h = width / 1.586;
  return (
    <View style={[{ width, height: h, borderRadius: 18, backgroundColor: c.surface, padding: 18, justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, elevation(c, 2)]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="overline" color="muted">
          {(categoryOf(doc.category)?.name ?? doc.category).toUpperCase()}
        </T>
        <DocThumb doc={doc} size={34} />
      </View>
      <View>
        <T v="heading" numberOfLines={1}>
          {doc.name}
        </T>
        <T v="caption" color="muted" style={{ marginTop: 2 }}>
          {doc.expiry ? `Valid until ${formatDate(doc.expiry)}` : `${doc.ext.toUpperCase()} · ${formatBytes(doc.size)}`}
        </T>
      </View>
    </View>
  );
}
