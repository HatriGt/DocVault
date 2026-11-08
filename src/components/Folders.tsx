import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TextInputInstance, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Button, T, Tap } from './ui';
import { BottomSheet } from './Sheet';
import { elevation, fonts, radius, space, type, useTheme } from '../theme';
import { DUR } from '../theme/motion';
import { useDocuments, useFolders } from '../lib/hooks';
import { createFolder, Folder, FOLDER_COLORS, FOLDER_ICONS, isWithin, pathTo, updateFolder } from '../lib/folders';

type IconName = keyof typeof Ionicons.glyphMap;

/** Folder tile: tinted rounded square with icon, name and item count. */
export function FolderTile({ folder, width, onPress, onLongPress }: { folder: Folder; width: number; onPress: () => void; onLongPress?: () => void }) {
  const { c } = useTheme();
  const folders = useFolders();
  const { docs } = useDocuments();
  const subs = folders.filter((f) => f.parent_id === folder.id).length;
  const items = docs.filter((d) => d.folder_id === folder.id).length;
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} accessibilityLabel={`Folder ${folder.name}`} style={{ width, borderRadius: radius.lg, backgroundColor: c.surface, padding: space.md, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
      <View style={{ height: width * 0.48, borderRadius: radius.md, backgroundColor: folder.color + '14', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="folder" size={width * 0.34} color={folder.color} />
        {folder.icon !== 'folder' && (
          <View style={{ position: 'absolute', top: width * 0.2, alignItems: 'center' }}>
            <Ionicons name={folder.icon as IconName} size={width * 0.13} color="#fff" />
          </View>
        )}
      </View>
      <View>
        <T v="bodyStrong" numberOfLines={1}>
          {folder.name}
        </T>
        <T v="caption" color="muted">
          {items} {items === 1 ? 'item' : 'items'}
          {subs ? ` · ${subs} ${subs === 1 ? 'folder' : 'folders'}` : ''}
        </T>
      </View>
    </Tap>
  );
}

/** Create / edit a folder: name, colour and icon. */
export function FolderEditor({
  visible,
  onClose,
  parentId,
  folder,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  parentId?: string | null;
  folder?: Folder | null;
  onSaved?: (f: Folder) => void;
}) {
  const { c } = useTheme();
  const [name, setName] = useState(folder?.name ?? '');
  const [color, setColor] = useState(folder?.color ?? FOLDER_COLORS[0]);
  const [icon, setIcon] = useState<string>(folder?.icon ?? 'folder');
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const input = useRef<TextInputInstance | null>(null);
  useEffect(() => {
    if (!visible || folder) return;
    // Focus only after the sheet has settled, so the keyboard doesn't fight the entrance animation.
    const t = setTimeout(() => input.current?.focus(), DUR.slow + 60);
    return () => clearTimeout(t);
  }, [visible, folder]);
  const key = visible ? folder?.id ?? `new:${parentId ?? ''}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (visible) {
      setName(folder?.name ?? '');
      setColor(folder?.color ?? FOLDER_COLORS[0]);
      setIcon(folder?.icon ?? 'folder');
    }
  }
  const save = async () => {
    if (folder) {
      await updateFolder(folder.id, { name: name.trim() || folder.name, color, icon });
      onSaved?.({ ...folder, name, color, icon });
    } else {
      onSaved?.(await createFolder(name, parentId ?? null, color, icon));
    }
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={folder ? 'Edit folder' : 'New folder'}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', paddingVertical: space.sm }}>
          <Animated.View key={color + icon} entering={FadeIn.duration(200)} style={{ width: 96, height: 80, borderRadius: radius.lg, backgroundColor: color + '1C', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="folder" size={60} color={color} />
            {icon !== 'folder' && (
              <View style={{ position: 'absolute', top: 32 }}>
                <Ionicons name={icon as IconName} size={22} color="#fff" />
              </View>
            )}
          </Animated.View>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Folder name"
          placeholderTextColor={c.textFaint}
          ref={input}
          returnKeyType="done"
          onSubmitEditing={save}
          style={[type.heading, { color: c.text, backgroundColor: c.surface, borderRadius: radius.md, height: 56, paddingHorizontal: space.lg, textAlign: 'center' }]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' }}>
          {FOLDER_COLORS.map((h) => (
            <Tap key={h} onPress={() => setColor(h)} accessibilityLabel={`Colour ${h}`} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: h, borderWidth: color === h ? 3 : 0, borderColor: c.surface, ...(color === h ? elevation(c, 2) : {}) }}>
              <View />
            </Tap>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' }}>
          {FOLDER_ICONS.map((i) => (
            <Tap key={i} onPress={() => setIcon(i)} accessibilityLabel={`Icon ${i}`} style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: icon === i ? color + '22' : c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={i as IconName} size={22} color={icon === i ? color : c.textMuted} />
            </Tap>
          ))}
        </View>
        <Button title={folder ? 'Save' : 'Create folder'} onPress={save} disabled={!name.trim()} />
      </ScrollView>
    </BottomSheet>
  );
}

/** Browse the folder tree and pick a destination (root allowed). */
export function FolderPicker({
  visible,
  onClose,
  value,
  onPick,
  title = 'Choose folder',
  action = 'Select this folder',
  excludeId,
}: {
  visible: boolean;
  onClose: () => void;
  value: string | null;
  onPick: (id: string | null) => void;
  title?: string;
  action?: string;
  excludeId?: string;
}) {
  const { c } = useTheme();
  const folders = useFolders();
  const [cwd, setCwd] = useState<string | null>(value);
  const [creating, setCreating] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const startCreate = () => {
    setCreating(true); // picker leaves first…
    setTimeout(() => setEditorOpen(true), DUR.fast + 60); // …then the editor arrives
  };
  const endCreate = () => {
    setEditorOpen(false);
    setTimeout(() => setCreating(false), DUR.fast + 60);
  };
  if (visible !== opened) {
    setOpened(visible);
    if (visible) setCwd(value);
  }
  const crumbs = pathTo(folders, cwd);
  const children = useMemo(
    () => folders.filter((f) => f.parent_id === cwd && !(excludeId && isWithin(folders, f.id, excludeId))),
    [folders, cwd, excludeId],
  );
  return (
    <>
      <BottomSheet visible={visible && !creating} onClose={onClose} title={title}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 4, alignItems: 'center', paddingBottom: space.md }}>
          <Tap onPress={() => setCwd(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="home" size={15} color={cwd ? c.textMuted : c.accent} />
            <T v="callout" color={cwd ? 'muted' : 'accent'} style={{ fontFamily: fonts.semibold }}>
              All documents
            </T>
          </Tap>
          {crumbs.map((f, i) => (
            <Animated.View key={f.id} entering={FadeInDown.duration(160)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chevron-forward" size={14} color={c.textFaint} />
              <Tap onPress={() => setCwd(f.id)}>
                <T v="callout" color={i === crumbs.length - 1 ? 'accent' : 'muted'} style={{ fontFamily: fonts.semibold }}>
                  {f.name}
                </T>
              </Tap>
            </Animated.View>
          ))}
        </ScrollView>
        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.sm }}>
          {children.length === 0 && (
            <T v="callout" color="muted" style={{ textAlign: 'center', paddingVertical: space.xl }}>
              No subfolders here.
            </T>
          )}
          {children.map((f) => (
            <Animated.View key={f.id} layout={LinearTransition} entering={FadeIn}>
              <Tap onPress={() => setCwd(f.id)} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.md, padding: space.md }, elevation(c, 1)]}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: f.color + '1C', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="folder" size={22} color={f.color} />
                </View>
                <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {f.name}
                </T>
                <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
              </Tap>
            </Animated.View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, marginTop: space.lg }}>
          <Button title="New folder" icon="add" variant="secondary" onPress={startCreate} style={{ flex: 1 }} />
          <Button
            title={action}
            onPress={() => {
              onPick(cwd);
              onClose();
            }}
            style={{ flex: 1.4 }}
          />
        </View>
      </BottomSheet>
      <FolderEditor visible={visible && editorOpen} onClose={endCreate} parentId={cwd} onSaved={(f) => setCwd(f.id)} />
    </>
  );
}

/** "Folder › Sub" label for a folder id. */
export function useFolderLabel(id: string | null | undefined) {
  const folders = useFolders();
  if (!id) return 'All documents';
  return pathTo(folders, id).map((f) => f.name).join(' › ') || 'All documents';
}
