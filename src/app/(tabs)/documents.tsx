import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInputInstance, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, EmptyState, IconButton, Screen, SearchField, T, Tap } from '../../components/ui';
import { DocRow, DocTile } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { Fab } from './index';
import { space } from '../../theme';
import { useCategories, useDocuments } from '../../lib/hooks';
import { kvGet, kvSet, DocRecord } from '../../lib/db';
import { docActions } from '../../lib/actions';
import { parseFields } from '../../lib/documents';

type Sort = 'added' | 'name' | 'accessed';
const SORT_LABEL: Record<Sort, string> = { added: 'Recently added', name: 'Name', accessed: 'Recently opened' };

export default function Documents() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const { docs, loading } = useDocuments();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(params.category ?? 'all');
  const [sort, setSort] = useState<Sort>('added');
  const [grid, setGrid] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const input = useRef<TextInputInstance | null>(null);

  useEffect(() => {
    kvGet<boolean>('ui.grid', false).then(setGrid);
  }, []);
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    if (params.category) setCategory(params.category);
  }
  useEffect(() => {
    if (params.focus) setTimeout(() => input.current?.focus(), 300);
  }, [params.focus]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = docs.filter((d) => (category === 'all' || d.category === category) && (!offlineOnly || d.has_local));
    if (q) {
      list = list.filter((d) => {
        const f = parseFields(d);
        return [d.name, d.doc_type, d.category, f.holder, f.issuer, f.country, f.number, d.notes]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q));
      });
    }
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'accessed' ? (b.accessed_at ?? 0) - (a.accessed_at ?? 0) : b.created_at - a.created_at,
    );
  }, [docs, query, category, sort, offlineOnly]);

  const cols = 2;
  const tileW = (width - space.xl * 2 - space.lg) / cols;

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.md }}>
        <T v="title">Documents</T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={grid ? 'list' : 'grid-outline'}
            label={grid ? 'Show as list' : 'Show as grid'}
            onPress={() => {
              setGrid(!grid);
              kvSet('ui.grid', !grid);
            }}
          />
          <IconButton icon="swap-vertical" label="Sort" onPress={() => setSortOpen(true)} />
        </View>
      </View>
      <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
        <SearchField ref={input} value={query} onChangeText={setQuery} placeholder="Search name, number, issuer…" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.lg }}>
        <Chip label="All" active={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map((cat) => (
          <Chip key={cat.id} label={cat.name} icon={cat.icon as never} active={category === cat.id} onPress={() => setCategory(cat.id)} />
        ))}
        <Chip label="Offline" icon="cloud-done-outline" active={offlineOnly} onPress={() => setOfflineOnly(!offlineOnly)} />
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, marginBottom: space.sm }}>
        <T v="callout" color="muted">
          {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
        </T>
        <Tap onPress={() => setSortOpen(true)}>
          <T v="callout" color="muted">
            {SORT_LABEL[sort]} ▾
          </T>
        </Tap>
      </View>
    </View>
  );

  const empty = loading ? undefined : docs.length === 0 ? (
    <EmptyState icon="documents-outline" title="No documents yet" body="Scan or import a document to get started." action="Add document" onAction={() => router.push('/add')} />
  ) : (
    <EmptyState icon="search" title="No matches" body={`Nothing matches “${query || 'these filters'}”. Try a different search or category.`} />
  );

  return (
    <Screen>
      <FlatList
        key={grid ? 'grid' : 'list'}
        data={filtered}
        keyExtractor={(d) => d.id}
        numColumns={grid ? cols : 1}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        columnWrapperStyle={grid ? { gap: space.lg, paddingHorizontal: space.xl, marginBottom: space.xl } : undefined}
        renderItem={({ item }) =>
          grid ? (
            <DocTile doc={item} width={tileW} />
          ) : (
            <View style={{ paddingHorizontal: space.xl }}>
              <DocRow doc={item} onMore={setMenuDoc} />
            </View>
          )
        }
      />
      <Fab />
      <ActionSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        actions={(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({
          label: SORT_LABEL[s],
          icon: sort === s ? 'checkmark-circle' : 'ellipse-outline',
          onPress: () => setSort(s),
        }))}
      />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
    </Screen>
  );
}
