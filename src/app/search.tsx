import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInputInstance, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, EmptyState, SearchField, T, Tap } from '../components/ui';
import { DocRow } from '../components/docs';
import { FolderTile } from '../components/Folders';
import { fonts, space, useTheme } from '../theme';
import { useDocuments, useFolders, useTags } from '../lib/hooks';
import { kvGet, kvSet } from '../lib/db';
import { isImage, isPdf, parseFields, parseTags } from '../lib/documents';
import { daysUntil } from '../lib/format';

type Filter = 'pdf' | 'image' | 'expiring' | 'favorite' | 'offline';
const FILTERS: { k: Filter; label: string; icon: string }[] = [
  { k: 'pdf', label: 'PDFs', icon: 'document-text-outline' },
  { k: 'image', label: 'Images', icon: 'image-outline' },
  { k: 'expiring', label: 'Expiring', icon: 'time-outline' },
  { k: 'favorite', label: 'Favorites', icon: 'heart-outline' },
  { k: 'offline', label: 'Offline', icon: 'cloud-done-outline' },
];

/** Spotlight: full-screen search across names, numbers, holders, issuers, notes, #tags and folders. */
export default function Search() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { docs } = useDocuments();
  const folders = useFolders();
  const tags = useTags();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<TextInputInstance | null>(null);

  useEffect(() => {
    kvGet<string[]>('search.recent', []).then(setRecent);
    const t = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, 8);
    setRecent(next);
    kvSet('search.recent', next);
  };

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    let list = docs;
    for (const f of filters) {
      if (f === 'pdf') list = list.filter(isPdf);
      if (f === 'image') list = list.filter(isImage);
      if (f === 'expiring') list = list.filter((d) => (daysUntil(d.expiry) ?? 999) <= 90);
      if (f === 'favorite') list = list.filter((d) => d.favorite);
      if (f === 'offline') list = list.filter((d) => d.has_local);
    }
    if (!query) return filters.length ? list : [];
    if (query.startsWith('#')) return list.filter((d) => parseTags(d).some((t) => t.startsWith(query.slice(1))));
    return list
      .map((d) => {
        const f = parseFields(d);
        const fields = [d.name, d.doc_type, f.holder, f.number, f.issuer, f.country, d.notes, ...parseTags(d).map((t) => `#${t}`)].filter(Boolean).map((s) => s!.toLowerCase());
        const score = fields[0]?.startsWith(query) ? 3 : fields[0]?.includes(query) ? 2 : fields.some((s) => s.includes(query)) ? 1 : 0;
        return { d, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.d);
  }, [docs, query, filters]);
  const folderHits = query && !query.startsWith('#') ? folders.filter((f) => f.name.toLowerCase().includes(query)).slice(0, 6) : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl }}>
        <View style={{ flex: 1 }}>
          <SearchField ref={input} value={q} onChangeText={setQ} placeholder="Search everything" onSubmitEditing={() => remember(q)} />
        </View>
        <Tap onPress={() => router.back()} hitSlop={10}>
          <T v="callout" style={{ fontFamily: fonts.semibold }}>
            Cancel
          </T>
        </Tap>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.md }}>
        {FILTERS.map((f) => (
          <Chip key={f.k} label={f.label} icon={f.icon as never} active={filters.includes(f.k)} onPress={() => setFilters((s) => (s.includes(f.k) ? s.filter((x) => x !== f.k) : [...s, f.k]))} />
        ))}
      </ScrollView>

      {!query && !filters.length ? (
        <Animated.View entering={FadeIn} style={{ paddingHorizontal: space.xl, gap: space.xl, marginTop: space.md }}>
          {recent.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm }}>
                <T v="overline" color="muted">
                  RECENT
                </T>
                <Tap onPress={() => (setRecent([]), kvSet('search.recent', []))}>
                  <T v="caption" color={c.gold}>
                    Clear
                  </T>
                </Tap>
              </View>
              {recent.map((r) => (
                <Tap key={r} onPress={() => setQ(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
                  <Ionicons name="time-outline" size={18} color={c.textFaint} />
                  <T v="body">{r}</T>
                </Tap>
              ))}
            </View>
          )}
          {tags.length > 0 && (
            <View>
              <T v="overline" color="muted" style={{ marginBottom: space.sm }}>
                TAGS
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {tags.slice(0, 16).map((t) => (
                  <Chip key={t.tag} label={`#${t.tag}`} onPress={() => setQ(`#${t.tag}`)} />
                ))}
              </View>
            </View>
          )}
          <T v="caption" color="faint">
            Tip: search by document number, holder name, issuer, or a #tag.
          </T>
        </Animated.View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(d) => d.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.xxl }}
          ListHeaderComponent={
            folderHits.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}>
                {folderHits.map((f) => (
                  <FolderTile key={f.id} folder={f} width={128} onPress={() => router.push(`/folder/${f.id}`)} />
                ))}
              </ScrollView>
            ) : undefined
          }
          ListEmptyComponent={<EmptyState icon="search" title="No results" body={`Nothing matches “${q}”.`} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 25)}>
              <DocRow
                doc={item}
                onPress={() => {
                  remember(q);
                  router.push(`/doc/${item.id}`);
                }}
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}
