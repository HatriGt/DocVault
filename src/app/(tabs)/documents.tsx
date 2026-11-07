import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, TextInputInstance, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, EmptyState, IconButton, Screen, SearchField, T, Tap } from '../../components/ui';
import { DocRow, DocTile } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { Fab } from './index';
import { fonts, radius, space, useTheme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { Backdrop } from '../../components/Backdrop';
import { TAB_BAR_HEIGHT } from '../../components/TabBar';
import { useCategories, useDocuments, useFolders, useTags } from '../../lib/hooks';
import { FolderEditor, FolderTile } from '../../components/Folders';
import { kvGet, kvSet, DocRecord } from '../../lib/db';
import { docActions } from '../../lib/actions';
import { parseFields, parseTags } from '../../lib/documents';

type Sort = 'added' | 'name' | 'accessed';
const SORT_LABEL: Record<Sort, string> = { added: 'Recently added', name: 'Name', accessed: 'Recently opened' };

export default function Documents() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; focus?: string; tag?: string }>();
  const { docs, loading } = useDocuments();
  const categories = useCategories();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(params.category ?? 'all');
  const [sort, setSort] = useState<Sort>('added');
  const [grid, setGrid] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [tag, setTag] = useState<string | null>(params.tag ?? null);
  const allTags = useTags();
  const folders = useFolders();
  const rootFolders = folders.filter((f) => !f.parent_id);
  const [newFolder, setNewFolder] = useState(false);
  const [lastTagParam, setLastTagParam] = useState(params.tag);
  if (params.tag !== lastTagParam) {
    setLastTagParam(params.tag);
    if (params.tag) setTag(params.tag);
  }
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
    let list = docs.filter(
      (d) => (category === 'all' || d.category === category) && (!offlineOnly || d.has_local) && (!tag || parseTags(d).includes(tag)),
    );
    if (q.startsWith('#')) {
      const t = q.slice(1);
      list = list.filter((d) => parseTags(d).some((x) => x.startsWith(t)));
    } else if (q) {
      list = list.filter((d) => {
        const f = parseFields(d);
        return [d.name, d.doc_type, d.category, f.holder, f.issuer, f.country, f.number, d.notes, ...parseTags(d).map((t) => `#${t}`)]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q));
      });
    }
    return [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'accessed' ? (b.accessed_at ?? 0) - (a.accessed_at ?? 0) : b.created_at - a.created_at,
    );
  }, [docs, query, category, sort, offlineOnly, tag]);

  const cols = 2;
  const tileW = (width - space.xl * 2 - space.lg) / cols;

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.md }}>
        <T v="title" style={{ fontSize: 32, lineHeight: 38 }}>Documents</T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton
            icon={grid ? 'list-outline' : 'grid-outline'}
            label={grid ? 'Show as list' : 'Show as grid'}
            onPress={() => {
              setGrid(!grid);
              kvSet('ui.grid', !grid);
            }}
          />
          <IconButton icon="options-outline" label="Sort and filter" onPress={() => setSortOpen(true)} />
        </View>
      </View>
      <View style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
        <SearchField ref={input} value={query} onChangeText={setQuery} placeholder="Search, or type #tag" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.lg }}>
        <Chip label="All" active={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map((cat) => (
          <Chip key={cat.id} label={cat.name} icon={cat.icon as never} tint={cat.hue} active={category === cat.id} onPress={() => setCategory(cat.id)} />
        ))}
        <Chip label="Offline" icon="cloud-done-outline" active={offlineOnly} onPress={() => setOfflineOnly(!offlineOnly)} />
      </ScrollView>
      {!query && category === 'all' && !tag && (
        <View style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.md }}>
            <T v="heading">Folders</T>
            <Tap onPress={() => setNewFolder(true)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add-circle" size={18} color={c.accent} />
              <T v="callout" color="accent" style={{ fontFamily: fonts.semibold }}>
                New
              </T>
            </Tap>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.sm }}>
            {rootFolders.map((f) => (
              <FolderTile key={f.id} folder={f} width={136} onPress={() => router.push(`/folder/${f.id}`)} />
            ))}
            {rootFolders.length === 0 && (
              <Tap
                onPress={() => setNewFolder(true)}
                style={{ width: 220, height: 130, borderRadius: radius.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: c.accent + '55', alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.md }}
              >
                <Ionicons name="folder-open" size={28} color={c.accent} />
                <T v="callout" color="accent" style={{ fontFamily: fonts.semibold, textAlign: 'center' }}>
                  Create your first folder
                </T>
                <T v="caption" color="muted" style={{ textAlign: 'center' }}>
                  e.g. Family › Kids › School
                </T>
              </Tap>
            )}
          </ScrollView>
        </View>
      )}
      {allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingBottom: space.lg, marginTop: -space.sm }}>
          {allTags.map((t) => (
            <Chip key={t.tag} label={`#${t.tag}`} active={tag === t.tag} onPress={() => setTag(tag === t.tag ? null : t.tag)} />
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, marginBottom: space.sm }}>
        <T v="callout" style={{ fontFamily: fonts.semibold }}>
          {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
        </T>
        <Tap onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T v="callout" style={{ fontFamily: fonts.semibold }}>
            {SORT_LABEL[sort]}
          </T>
          <Ionicons name="chevron-down" size={16} color={c.text} />
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
      <Backdrop variant="list" />
      <FlatList
        key={grid ? 'grid' : 'list'}
        data={filtered}
        keyExtractor={(d) => d.id}
        numColumns={grid ? cols : 1}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 120 }}
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
      <FolderEditor visible={newFolder} onClose={() => setNewFolder(false)} parentId={null} onSaved={(f) => router.push(`/folder/${f.id}`)} />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
    </Screen>
  );
}
