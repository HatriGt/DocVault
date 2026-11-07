import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { DocRecord } from './db';
import { deleteDocument, exportCopy, isImage, openNative, shareDocument, toggleFavorite } from './documents';
import type { SheetAction } from '../components/Sheet';

const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));

export async function openDoc(doc: DocRecord) {
  try {
    if (isImage(doc)) router.push(`/viewer/${doc.id}`);
    else await openNative(doc);
  } catch (e) {
    fail(e);
  }
}

export async function shareDoc(doc: DocRecord) {
  try {
    await shareDocument(doc);
  } catch (e) {
    fail(e);
  }
}

export function confirmDelete(doc: DocRecord, after?: () => void) {
  Alert.alert(
    `Delete “${doc.name}”?`,
    doc.sync_state === 'local_only'
      ? 'It will be permanently removed from this device.'
      : 'It will be removed from this device, your Google Drive vault and your other devices.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          after?.();
        },
      },
    ],
  );
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
    { label: 'Save a copy', icon: 'download-outline', onPress: () => exportCopy(doc).catch(fail) },
    { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(doc) },
  ];
}
