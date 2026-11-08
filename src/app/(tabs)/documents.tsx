import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Backdrop } from '../../components/Backdrop';
import { TabSwipe } from '../../components/TabSwipe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Button, Chip, EmptyState, IconButton, Screen, SearchField, T, Tap } from '../../components/ui';
import { DocRow, DocTile } from '../../components/docs';
import { ActionSheet, BottomSheet } from '../../components/Sheet';
import { TAB_BAR_HEIGHT } from '../../components/TabBar';
import { FolderEditor, FolderPicker, FolderTile } from '../../components/Folders';
import { TagInput } from '../../components/Tags';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useCategories, useDocuments, useFolders, useTags } from '../../lib/hooks';
import { DocRecord, kvGet, kvSet } from '../../lib/db';
import { confirmDelete, docActions } from '../../lib/actions';
import { SkeletonRows, SwipeRow } from '../../components/motion';
import { parseTags, toggleFavorite } from '../../lib/documents';
import { confirmDeleteMany, favoriteMany, moveMany, shareAsOnePdf, tagMany } from '../../lib/batch';
import { DUR, EASE_OUT } from '../../theme/motion';

type Sort = 'added' | 'name' | 'accessed' | 'expiry';
const SORT_LABEL: Record<Sort, string> = { added: 'Recently added', name: 'Name', accessed: 'Recently opened', expiry: 'Expiring soonest' };

export default function Library() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; tag?: string }>();
  const { docs, loading } = useDocuments();
  const categories = useCategories();
  const allTags = useTags();
  const folders = useFolders();
  const rootFolders = folders.filter((f) => !f.parent_id);

  const [category, setCategory] = useState<string>(params.category ?? 'all');
  const [tag, setTag] = useState<string | null>(params.tag ?? null);
  const [sort, setSort] = useState<Sort>('added');
  const [grid, setGrid] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  // selection
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const [lastParams, setLastParams] = useState(`${params.category}|${params.tag}`);
  if (`${params.category}|${params.tag}` !== lastParams) {
    setLastParams(`${params.category}|${params.tag}`);
    if (params.category) setCategory(params.category);
    if (params.tag) setTag(params.tag);
  }

  useEffect(() => {
    kvGet<boolean>('ui.grid', false).then(setGrid);
  }, []);

  const filtered = useMemo(() => {
    const list = docs.filter((d) => (category === 'all' || d.category === category) && (!tag || parseTags(d).includes(tag)));
    return [...list].sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'accessed'
          ? (b.accessed_at ?? 0) - (a.accessed_at ?? 0)
          : sort === 'expiry'
            ? (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999')
            : b.created_at - a.created_at,
    );
  }, [docs, category, tag, sort]);

  const selectedDocs = filtered.filter((d) => sel.includes(d.id));
  const toggle = (d: DocRecord) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]));
  };
  const exitSelect = () => {
    setSelecting(false);
    setSel([]);
  };
  const startSelect = (d?: DocRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelecting(true);
    setSel(d ? [d.id] : []);
  };

  const sharePack = async () => {
    setSharing(true);
    try {
      const skipped = await shareAsOnePdf(selectedDocs, selectedDocs.length === 1 ? selectedDocs[0].name : `DocVault pack (${selectedDocs.length})`);
      if (skipped) Alert.alert('Some files were left out', `${skipped} selected ${skipped === 1 ? 'file isn’t' : 'files aren’t'} a PDF or image.`);
    } catch (e) {
      Alert.alert('Couldn’t create the PDF', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  const tileW = (width - space.xl * 2 - space.lg) / 2;

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.md }}>
        <T v="title">{selecting ? `${sel.length} selected` : 'Library'}</T>
        {selecting ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={sel.length === filtered.length ? 'None' : 'All'} variant="secondary" size="md" onPress={() => setSel(sel.length === filtered.length ? [] : filtered.map((d) => d.id))} />
            <Button title="Done" size="md" onPress={exitSelect} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <IconButton icon={grid ? 'list-outline' : 'grid-outline'} label={grid ? 'List view' : 'Grid view'} size={40} onPress={() => (setGrid(!grid), kvSet('ui.grid', !grid))} />
            <IconButton icon="checkmark-circle-outline" label="Select" size={40} onPress={() => startSelect()} />
          </View>
        )}
      </View>

      {!selecting && (
        <>
          <Tap onPress={() => router.push('/search')} haptic={false} scaleTo={0.99} style={{ marginHorizontal: space.xl, marginTop: space.lg }}>
            <View pointerEvents="none">
              <SearchField placeholder="Search names, numbers, #tags" editable={false} />
            </View>
          </Tap>

          {/* Folders */}
          <View style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space.xl, marginBottom: space.md }}>
              <T v="heading">Folders</T>
              <Tap onPress={() => setNewFolder(true)} hitSlop={10}>
                <T v="callout" color={c.gold} style={{ fontFamily: fonts.semibold }}>
                  New folder
                </T>
              </Tap>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
              {rootFolders.map((f) => (
                <FolderTile key={f.id} folder={f} width={132} onPress={() => router.push(`/folder/${f.id}`)} />
              ))}
              {rootFolders.length === 0 && (
                <Tap onPress={() => setNewFolder(true)} style={{ width: 210, height: 120, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.md }}>
                  <Ionicons name="folder-open-outline" size={24} color={c.textMuted} />
                  <T v="callout">Create a folder</T>
                  <T v="caption" color="muted">
                    e.g. Family › Kids › School
                  </T>
                </Tap>
              )}
            </ScrollView>
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.xl }}>
            <Chip label="All" active={category === 'all' && !tag} onPress={() => (setCategory('all'), setTag(null))} />
            {categories.map((cat) => (
              <Chip key={cat.id} label={cat.name} icon={cat.icon as never} active={category === cat.id} onPress={() => setCategory(category === cat.id ? 'all' : cat.id)} />
            ))}
            {allTags.slice(0, 12).map((t) => (
              <Chip key={t.tag} label={`#${t.tag}`} active={tag === t.tag} onPress={() => setTag(tag === t.tag ? null : t.tag)} />
            ))}
          </ScrollView>
        </>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.xs }}>
        <T v="overline" color="muted">
          {filtered.length} {filtered.length === 1 ? 'DOCUMENT' : 'DOCUMENTS'}
        </T>
        <Tap onPress={() => setSortOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T v="caption" color="muted">
            {SORT_LABEL[sort]}
          </T>
          <Ionicons name="chevron-down" size={14} color={c.textMuted} />
        </Tap>
      </View>
    </View>
  );

  return (
    <TabSwipe>
    <Screen>
      <Backdrop variant="list" />
      <FlatList
        key={grid && !selecting ? 'grid' : 'list'}
        data={filtered}
        keyExtractor={(d) => d.id}
        numColumns={grid && !selecting ? 2 : 1}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: space.xl }}>
              <SkeletonRows count={6} />
            </View>
          ) : docs.length === 0 ? (
            <EmptyState icon="albums-outline" title="Nothing here yet" body="Scan or import a document with the + button." />
          ) : (
            <EmptyState icon="funnel-outline" title="No matches" body="Try another category or tag." />
          )
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + (selecting ? 150 : 60) }}
        columnWrapperStyle={grid && !selecting ? { gap: space.lg, paddingHorizontal: space.xl, marginTop: space.lg } : undefined}
        renderItem={({ item }) =>
          grid && !selecting ? (
            <DocTile doc={item} width={tileW} />
          ) : (
            <View style={{ paddingHorizontal: space.xl }}>
              {selecting ? (
                <DocRow doc={item} selected={sel.includes(item.id)} onPress={() => toggle(item)} onMore={setMenuDoc} />
              ) : (
                <SwipeRow favorite={!!item.favorite} onFavorite={() => toggleFavorite(item)} onDelete={() => confirmDelete(item)}>
                  <DocRow doc={item} onLongPress={() => startSelect(item)} onMore={setMenuDoc} />
                </SwipeRow>
              )}
            </View>
          )
        }
      />

      {/* Batch bar */}
      {selecting && (
        <Animated.View
          entering={SlideInDown.duration(DUR.slow).easing(EASE_OUT)}
          exiting={SlideOutDown.duration(160)}
          style={[
            { position: 'absolute', left: space.lg, right: space.lg, bottom: Math.max(insets.bottom, space.md) + TAB_BAR_HEIGHT + space.md, backgroundColor: c.surface, borderRadius: radius.xl, paddingVertical: space.md, flexDirection: 'row', justifyContent: 'space-around', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
            elevation(c, 3),
          ]}
        >
          {(
            [
              { icon: 'document-text-outline', label: 'One PDF', go: sharePack, busy: sharing },
              { icon: 'folder-open-outline', label: 'Move', go: () => setMoveOpen(true) },
              { icon: 'pricetag-outline', label: 'Tag', go: () => (setBatchTags([]), setTagOpen(true)) },
              { icon: 'heart-outline', label: 'Favorite', go: () => favoriteMany(selectedDocs, !selectedDocs.every((d) => d.favorite)).then(exitSelect) },
              { icon: 'trash-outline', label: 'Delete', go: () => confirmDeleteMany(selectedDocs, exitSelect), danger: true },
            ] as { icon: keyof typeof Ionicons.glyphMap; label: string; go: () => void; busy?: boolean; danger?: boolean }[]
          ).map((a) => (
            <Tap key={a.label} onPress={a.go} disabled={!sel.length || a.busy} style={{ alignItems: 'center', gap: 4, width: 62, opacity: sel.length ? 1 : 0.35 }}>
              <Ionicons name={a.busy ? 'hourglass-outline' : a.icon} size={22} color={a.danger ? c.danger : c.text} />
              <T v="caption" color={a.danger ? c.danger : 'muted'} style={{ fontSize: 11 }}>
                {a.label}
              </T>
            </Tap>
          ))}
        </Animated.View>
      )}

      <ActionSheet
        visible={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort by"
        actions={(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({ label: SORT_LABEL[s], icon: sort === s ? 'checkmark-circle' : 'ellipse-outline', onPress: () => setSort(s) }))}
      />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
      <FolderEditor visible={newFolder} onClose={() => setNewFolder(false)} parentId={null} onSaved={(f) => router.push(`/folder/${f.id}`)} />
      <FolderPicker visible={moveOpen} onClose={() => setMoveOpen(false)} value={null} title={`Move ${sel.length} documents`} action="Move here" onPick={(dest) => moveMany(selectedDocs, dest).then(exitSelect)} />
      <BottomSheet visible={tagOpen} onClose={() => setTagOpen(false)} title={`Tag ${sel.length} documents`}>
        <Animated.View entering={FadeIn} style={{ paddingHorizontal: space.xl, gap: space.lg }}>
          <TagInput value={batchTags} onChange={setBatchTags} />
          <Button title="Add tags" disabled={!batchTags.length} onPress={() => tagMany(selectedDocs, batchTags).then(() => (setTagOpen(false), exitSelect()))} />
        </Animated.View>
      </BottomSheet>
    </Screen>
    </TabSwipe>
  );
}
