import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { DocRecord } from './db';
import { deleteDocument, exportCopy, restoreDocument, shareDocument, toggleFavorite } from './documents';
import { unlockDoc } from './guard';
import { toast } from './toast';
import type { SheetAction } from '../components/Sheet';

const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));

export async function openDoc(doc: DocRecord) {
  if (!(await unlockDoc(doc))) return;
  router.push(`/view/${doc.id}`);
}

export async function shareDoc(doc: DocRecord) {
  if (!(await unlockDoc(doc))) return;
  try {
    await shareDocument(doc);
  } catch (e) {
    fail(e);
  }
}

export async function presentDoc(doc: DocRecord) {
  if (!(await unlockDoc(doc))) return;
  router.push(`/present/${doc.id}`);
}

/** Moves to Recently Deleted immediately with an Undo toast (no blocking dialog). */
export async function confirmDelete(doc: DocRecord, after?: () => void) {
  await deleteDocument(doc);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  toast(`“${doc.name}” moved to Recently Deleted`, { icon: 'trash-outline', action: { label: 'Undo', run: () => restoreDocument({ ...doc, trashed_at: Date.now() }) } });
  after?.();
}

export function docActions(doc: DocRecord): SheetAction[] {
  return [
    { label: 'Open', icon: 'eye-outline', onPress: () => openDoc(doc) },
    { label: 'Share', icon: 'share-outline', onPress: () => shareDoc(doc) },
    {
      label: doc.favorite ? 'Remove from Favorites' : 'Add to Favorites',
      icon: doc.favorite ? 'heart-dislike-outline' : 'heart-outline',
      onPress: () => toggleFavorite(doc),
    },
    { label: 'Edit details', icon: 'create-outline', onPress: () => router.push(`/edit/${doc.id}`) },
    { label: 'Move to folder', icon: 'folder-open-outline', onPress: () => router.push(`/move/${doc.id}`) },
    { label: 'Present full screen', icon: 'expand-outline', onPress: () => presentDoc(doc) },
    { label: 'Save a copy', icon: 'download-outline', onPress: async () => {
        if (await unlockDoc(doc)) await exportCopy(doc).catch(fail);
      },
    },
    { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(doc) },
  ];
}
