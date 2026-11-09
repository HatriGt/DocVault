import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { DocRecord } from './db';
import { deleteDocument, exportCopy, OfflineChangeError, restoreDocument, setLocked, setOfflinePreference, shareDocument, toggleFavorite } from './documents';
import { unlockDoc } from './guard';
import type { SheetAction } from '../components/Sheet';
import { notify, notifyError } from './feedback';

const fail = (e: unknown) => notifyError(e, 'Something went wrong');

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
  notify(`“${doc.name}” moved to Recently deleted`, { icon: 'trash-outline', action: { label: 'Undo', run: () => restoreDocument({ ...doc, trashed_at: Date.now() }) } });
  after?.();
}

/** Toggles keeping a cloud document on this phone. */
export async function toggleOffline(doc: DocRecord) {
  try {
    await setOfflinePreference(doc, doc.offline_pref === 'keep' ? 'cloud' : 'keep');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch (e) {
    notifyError(e, e instanceof OfflineChangeError ? 'Not yet' : 'Couldn’t change offline storage');
  }
}

export async function toggleLock(doc: DocRecord) {
  if (doc.locked && !(await unlockDoc(doc))) return;
  try {
    await setLocked(doc, !doc.locked);
    notify(doc.locked ? 'Lock removed' : 'Locked — biometrics needed to open', { icon: doc.locked ? 'lock-open' : 'lock-closed' });
  } catch (e) {
    notifyError(e, 'Couldn’t change the lock');
  }
}

async function saveCopy(doc: DocRecord): Promise<void> {
  if (!(await unlockDoc(doc))) return;
  await exportCopy(doc).catch((e) => notifyError(e, 'Couldn’t save a copy', { retry: () => saveCopy(doc) }));
}

/**
 * The one menu of document actions, used by the document page and by every list row.
 * `inList` adds a Quick group (open, share, favourite) that the document page already shows
 * as buttons; `cloud` adds the offline toggle, which only means something with Drive backup.
 */
export function docActions(doc: DocRecord, opts: { inList?: boolean; cloud?: boolean; afterDelete?: () => void } = {}): SheetAction[] {
  const quick: SheetAction[] = opts.inList
    ? [
        { section: 'Quick', label: 'Open', icon: 'eye-outline', onPress: () => openDoc(doc) },
        { section: 'Quick', label: 'Share', icon: 'share-outline', onPress: () => shareDoc(doc) },
        {
          section: 'Quick',
          label: doc.favorite ? 'Remove from Wallet' : 'Add to Wallet',
          icon: doc.favorite ? 'heart-dislike-outline' : 'heart-outline',
          onPress: () => toggleFavorite(doc),
        },
      ]
    : [];
  return [
    ...quick,
    { section: 'Organise', label: 'Edit details', hint: 'Name, number, dates, tags', icon: 'create-outline', onPress: () => router.push(`/edit/${doc.id}`) },
    { section: 'Organise', label: 'Move to folder', icon: 'folder-open-outline', onPress: () => router.push(`/move/${doc.id}`) },
    ...(opts.inList ? [{ section: 'Organise', label: 'Present full screen', icon: 'expand-outline' as const, onPress: () => presentDoc(doc) }] : []),
    {
      section: 'Protect',
      label: doc.locked ? 'Remove biometric lock' : 'Lock with biometrics',
      hint: doc.locked ? undefined : 'Fingerprint or face needed to open',
      icon: doc.locked ? 'lock-open-outline' : 'lock-closed-outline',
      onPress: () => toggleLock(doc),
    },
    ...(opts.cloud
      ? [{
          section: 'Protect',
          label: doc.offline_pref === 'keep' ? 'Make cloud-only' : 'Keep offline',
          hint: doc.offline_pref === 'keep' ? 'Free space; download when opened' : 'Always available without internet',
          icon: (doc.offline_pref === 'keep' ? 'cloud-outline' : 'cloud-download-outline') as 'cloud-outline',
          onPress: () => toggleOffline(doc),
        }]
      : []),
    { section: 'Export', label: 'Save a decrypted copy', hint: 'To Downloads or another app', icon: 'download-outline', onPress: () => saveCopy(doc) },
    { section: 'Export', label: 'Move to trash', hint: 'Restore within 30 days', icon: 'trash-outline', destructive: true, onPress: () => confirmDelete(doc, opts.afterDelete) },
  ];
}
