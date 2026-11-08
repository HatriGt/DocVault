import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, IconButton, Screen, T, Tap } from '../../components/ui';
import { DocRow } from '../../components/docs';
import { ActionSheet } from '../../components/Sheet';
import { Backdrop } from '../../components/Backdrop';
import { FolderEditor, FolderPicker, FolderTile } from '../../components/Folders';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useDocuments, useFolders } from '../../lib/hooks';
import { deleteFolder, moveFolder, pathTo } from '../../lib/folders';
import { docActions } from '../../lib/actions';
import type { DocRecord } from '../../lib/db';
import { DUR, EASE_OUT } from '../../theme/motion';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const folders = useFolders();
  const { docs } = useDocuments();
  const folder = folders.find((f) => f.id === id);
  const crumbs = pathTo(folders, id ?? null);
  const subs = useMemo(() => folders.filter((f) => f.parent_id === id), [folders, id]);
  const items = useMemo(() => docs.filter((d) => d.folder_id === id), [docs, id]);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [moving, setMoving] = useState(false);
  const [menuDoc, setMenuDoc] = useState<DocRecord | null>(null);
  const tileW = (width - space.xl * 2 - space.md) / 2;

  if (!folder) {
    return (
      <Screen>
        <EmptyState icon="folder-open-outline" title="Folder not found" body="It may have been deleted on another device." action="Back" onAction={() => router.back()} />
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert(`Delete “${folder.name}”?`, 'Its documents and subfolders will move up to the parent folder. Nothing is deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete folder',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(folder.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Backdrop variant="list" />
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.sm }}>
              <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
              <IconButton icon="ellipsis-horizontal" label="Folder options" onPress={() => setMenu(true)} />
            </View>
            {/* Breadcrumbs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.lg, gap: 4, alignItems: 'center' }}>
              <Tap onPress={() => router.dismissTo('/(tabs)/documents')}>
                <T v="callout" color="muted" style={{ fontFamily: fonts.semibold }}>
                  Library
                </T>
              </Tap>
              {crumbs.map((f, i) => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chevron-forward" size={14} color={c.textFaint} />
                  <Tap onPress={() => i < crumbs.length - 1 && router.dismissTo(`/folder/${f.id}`)}>
                    <T v="callout" color={i === crumbs.length - 1 ? 'accent' : 'muted'} style={{ fontFamily: fonts.semibold }}>
                      {f.name}
                    </T>
                  </Tap>
                </View>
              ))}
            </ScrollView>
            <Animated.View entering={FadeInDown.duration(DUR.slow).easing(EASE_OUT)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, marginTop: space.md }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: folder.color + '1C', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={(folder.icon === 'folder' ? 'folder' : folder.icon) as keyof typeof Ionicons.glyphMap} size={28} color={folder.color} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="title" numberOfLines={1}>
                  {folder.name}
                </T>
                <T v="callout" color="muted">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                  {subs.length ? ` · ${subs.length} ${subs.length === 1 ? 'folder' : 'folders'}` : ''}
                </T>
              </View>
            </Animated.View>

            {/* Subfolders */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl, marginTop: space.xl }}>
              {subs.map((f, i) => (
                <Animated.View key={f.id} entering={FadeInRight.delay(i * 50).duration(DUR.slow).easing(EASE_OUT)}>
                  <FolderTile folder={f} width={tileW} onPress={() => router.push(`/folder/${f.id}`)} />
                </Animated.View>
              ))}
            </View>
            <Tap
              onPress={() => setEditing('new')}
              accessibilityLabel="New subfolder"
              style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.sm, height: 44, paddingHorizontal: space.lg, marginHorizontal: space.xl, marginTop: subs.length ? space.md : 0, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: c.textFaint }}
            >
              <Ionicons name="add" size={18} color={c.textMuted} />
              <T v="callout">New subfolder</T>
            </Tap>
            {items.length > 0 && (
              <T v="heading" style={{ paddingHorizontal: space.xl, marginTop: space.xxl, marginBottom: space.sm }}>
                Documents
              </T>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="document-outline"
            title="No documents here yet"
            body="Add one here, or move an existing document in from its ••• menu."
            action="Add a document"
            onAction={() => router.push({ pathname: '/add', params: { folder: folder.id } })}
          />
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.xl }}>
            <DocRow doc={item} onMore={setMenuDoc} />
          </View>
        )}
      />

      {/* Add into this folder (the empty state has its own button) */}
      {items.length > 0 && (
      <View style={{ position: 'absolute', right: space.xl, bottom: insets.bottom + space.xl }}>
        <Tap
          onPress={() => router.push({ pathname: '/add', params: { folder: folder.id } })}
          accessibilityLabel="Add document to this folder"
          style={[{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }, elevation(c, 3)]}
        >
          <Ionicons name="add" size={32} color={c.onAccent} />
        </Tap>
      </View>
      )}

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={folder.name}
        actions={[
          { label: 'New subfolder', icon: 'folder-open-outline', onPress: () => setEditing('new') },
          { label: 'Add document here', icon: 'document-attach-outline', onPress: () => router.push({ pathname: '/add', params: { folder: folder.id } }) },
          { label: 'Rename & style', icon: 'color-palette-outline', onPress: () => setEditing('edit') },
          { label: 'Move folder', icon: 'return-up-forward-outline', onPress: () => setMoving(true) },
          { label: 'Delete folder', icon: 'trash-outline', destructive: true, onPress: confirmDelete },
        ]}
      />
      <ActionSheet visible={!!menuDoc} onClose={() => setMenuDoc(null)} title={menuDoc?.name} actions={menuDoc ? docActions(menuDoc) : []} />
      <FolderEditor
        visible={editing != null}
        onClose={() => setEditing(null)}
        parentId={folder.id}
        folder={editing === 'edit' ? folder : null}
        onSaved={(f) => editing === 'new' && router.push(`/folder/${f.id}`)}
      />
      <FolderPicker
        visible={moving}
        onClose={() => setMoving(false)}
        value={folder.parent_id}
        excludeId={folder.id}
        title="Move folder to"
        action="Move here"
        onPick={(dest) => moveFolder(folder.id, dest).catch((e) => Alert.alert('Can’t move', e.message))}
      />
    </Screen>
  );
}
