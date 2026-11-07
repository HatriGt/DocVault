import { Platform } from 'react-native';
import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { hashHex, open, seal, utf8, uuid } from './crypto';
import { newWrappedDek, unwrapDek } from './keys';
import { deleteBlob, hasBlob, purgeTempPlain, readBlob, writeBlob, writeTempPlain } from './blobs';
import { DocRecord, getDoc, hardDeleteDoc, insertDoc, OfflinePref, updateDoc } from './db';
import { getAccount, getPrefs } from './session';
import { cancelReminders, scheduleReminders } from './notifications';
import { download as driveDownload } from './drive';
import { requestSync } from './syncQueue';

import { normalizeTags } from './tags';

export interface DocFields {
  holder?: string;
  number?: string;
  issuer?: string;
  country?: string;
  issued?: string;
}

export interface ImportSource {
  uri: string;
  name: string;
  mime: string;
}

export interface NewDocDetails {
  name: string;
  category: string;
  docType: string | null;
  expiry: string | null;
  fields: DocFields;
  favorite?: boolean;
  offlinePref?: OfflinePref;
  notes?: string | null;
  tags?: string[];
}
export { normalizeTags };

export const parseTags = (d: Pick<DocRecord, 'tags'>): string[] => {
  try {
    return JSON.parse(d.tags || '[]');
  } catch {
    return [];
  }
};

export const isImage = (d: Pick<DocRecord, 'mime'>) => d.mime.startsWith('image/');
export const isPdf = (d: Pick<DocRecord, 'mime'>) => d.mime === 'application/pdf';
export const parseFields = (d: DocRecord): DocFields => {
  try {
    return JSON.parse(d.fields || '{}');
  } catch {
    return {};
  }
};

function extFor(name: string, mime: string) {
  const m = name.match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1].toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/heic') return 'heic';
  return 'jpg';
}

const blobAad = (id: string) => `doc:${id}`;

/** Encrypts plaintext and stores it as a new document. Returns the record. */
export async function createDocument(plain: Uint8Array, src: { name: string; mime: string }, d: NewDocDetails) {
  const id = uuid();
  const { dek, wrapped } = await newWrappedDek(id);
  const ct = seal(dek, plain, blobAad(id));
  dek.fill(0);
  await writeBlob(id, ct);

  const account = await getAccount();
  const prefs = await getPrefs();
  const cloud = account?.mode === 'google';
  const now = Date.now();
  const rec: DocRecord = {
    id,
    name: d.name.trim() || 'Untitled document',
    category: d.category,
    doc_type: d.docType,
    mime: src.mime,
    ext: extFor(src.name, src.mime),
    size: plain.length,
    created_at: now,
    updated_at: now,
    accessed_at: null,
    expiry: d.expiry,
    favorite: d.favorite ? 1 : 0,
    pinned: 0,
    offline_pref: d.offlinePref ?? prefs.offlineDefault,
    has_local: 1,
    sync_state: cloud ? 'upload_pending' : 'local_only',
    content_dirty: cloud ? 1 : 0,
    meta_dirty: cloud ? 1 : 0,
    deleted: 0,
    wrapped_dek: wrapped,
    content_hash: hashHex(ct),
    remote_meta_id: null,
    remote_bin_id: null,
    upload_session: null,
    last_synced_at: null,
    last_error: null,
    attempts: 0,
    fields: JSON.stringify(d.fields ?? {}),
    back_id: null,
    notes: d.notes ?? null,
    tags: JSON.stringify(normalizeTags(d.tags ?? [])),
  };
  await insertDoc(rec);
  if (prefs.expiryReminders) scheduleReminders(rec).catch(() => {});
  requestSync();
  return rec;
}

export async function importDocument(src: ImportSource, d: NewDocDetails) {
  const plain = await new File(src.uri).bytes();
  return createDocument(plain, src, d);
}

/** Decrypts a document. Fetches ciphertext from Drive if it isn't on the device. */
export async function decryptDocument(doc: DocRecord): Promise<Uint8Array> {
  let ct: Uint8Array;
  if (hasBlob(doc.id)) {
    ct = await readBlob(doc.id);
  } else {
    if (!doc.remote_bin_id) throw new Error('This document is not available on this device.');
    try {
      ct = await driveDownload(doc.remote_bin_id);
    } catch {
      throw new Error('You’re offline and this document is cloud-only. Connect to the internet to open it.');
    }
    if (doc.offline_pref === 'keep') {
      await writeBlob(doc.id, ct);
      await updateDoc(doc.id, { has_local: 1, sync_state: 'synced' });
    }
  }
  const dek = await unwrapDek(doc.id, doc.wrapped_dek);
  try {
    return open(dek, ct, blobAad(doc.id));
  } finally {
    dek.fill(0);
  }
}

const fileNameFor = (doc: DocRecord) => `${doc.name.replace(/\.[a-z0-9]{2,5}$/i, '')}.${doc.ext}`;

export async function markAccessed(id: string) {
  await updateDoc(id, { accessed_at: Date.now() });
}

/** Decrypts to a temporary file for an in-app or native viewer. */
export async function materialize(doc: DocRecord) {
  const plain = await decryptDocument(doc);
  const f = await writeTempPlain(fileNameFor(doc), plain);
  markAccessed(doc.id);
  return f;
}

/** Opens the platform's native viewer (QuickLook on iOS, system viewer on Android). */
export async function openNative(doc: DocRecord) {
  const f = await materialize(doc);
  await f.preview();
}

/** Native share sheet (AirDrop, Quick Share, Mail, WhatsApp…). Works offline for local docs. */
export async function shareDocument(doc: DocRecord) {
  const f = await materialize(doc);
  try {
    await Sharing.shareAsync(f.uri, {
      mimeType: doc.mime,
      UTI: isPdf(doc) ? 'com.adobe.pdf' : isImage(doc) ? 'public.image' : undefined,
      dialogTitle: `Share ${doc.name}`,
    });
  } finally {
    // Give the receiving app a moment to copy before purging plaintext.
    setTimeout(purgeTempPlain, 60_000);
  }
}

/** Saves an unencrypted copy outside the vault, chosen explicitly by the user. */
export async function exportCopy(doc: DocRecord) {
  if (Platform.OS === 'android') {
    const dir = await Directory.pickDirectoryAsync();
    const plain = await decryptDocument(doc);
    const out = dir.createFile(fileNameFor(doc), doc.mime);
    await out.write(plain);
    return 'saved';
  }
  await shareDocument(doc); // iOS: "Save to Files" lives in the share sheet
  return 'shared';
}

export async function updateDetails(id: string, patch: Partial<Pick<DocRecord, 'name' | 'category' | 'doc_type' | 'expiry' | 'notes' | 'favorite' | 'pinned'>> & { fields?: DocFields; tags?: string[] }) {
  const doc = await getDoc(id);
  if (!doc) return;
  const { fields, tags, ...rest } = patch;
  const cloud = doc.sync_state !== 'local_only';
  await updateDoc(id, {
    ...rest,
    ...(fields ? { fields: JSON.stringify(fields) } : {}),
    ...(tags ? { tags: JSON.stringify(normalizeTags(tags)) } : {}),
    updated_at: Date.now(),
    ...(cloud ? { meta_dirty: 1, sync_state: doc.sync_state === 'synced' ? 'upload_pending' : doc.sync_state } : {}),
  });
  const next = await getDoc(id);
  if (next && ('expiry' in patch || 'name' in patch)) {
    if ((await getPrefs()).expiryReminders) scheduleReminders(next).catch(() => {});
  }
  requestSync();
}

export const toggleFavorite = (doc: DocRecord) => updateDetails(doc.id, { favorite: doc.favorite ? 0 : 1 });
export const togglePinned = (doc: DocRecord) => updateDetails(doc.id, { pinned: doc.pinned ? 0 : 1 });

export async function deleteDocument(doc: DocRecord) {
  deleteBlob(doc.id);
  cancelReminders(doc.id).catch(() => {});
  if (!doc.remote_meta_id && !doc.remote_bin_id) {
    await hardDeleteDoc(doc.id);
    return;
  }
  // Tombstone: other devices learn about the deletion on their next sync.
  await updateDoc(doc.id, { deleted: 1, meta_dirty: 1, has_local: 0, updated_at: Date.now(), sync_state: 'upload_pending' });
  requestSync();
}

export class OfflineChangeError extends Error {}

/** Changes offline availability. Never removes a local copy that isn't safely in the cloud. */
export async function setOfflinePreference(doc: DocRecord, pref: OfflinePref) {
  if (pref === 'cloud') {
    if (!doc.remote_bin_id || doc.content_dirty) {
      throw new OfflineChangeError(
        doc.sync_state === 'local_only'
          ? 'Connect Google Drive to make documents cloud-only.'
          : 'This document hasn’t finished uploading yet. It will stay on this device until it’s safely backed up.',
      );
    }
    deleteBlob(doc.id);
    await updateDoc(doc.id, { offline_pref: 'cloud', has_local: 0, sync_state: 'synced' });
  } else {
    await updateDoc(doc.id, {
      offline_pref: 'keep',
      sync_state: doc.has_local ? doc.sync_state : 'download_pending',
    });
    requestSync();
  }
}

/** Re-encrypts a local document under a new id (used for sync conflict copies). */
export async function duplicateAsConflictCopy(doc: DocRecord) {
  const plain = await decryptDocument(doc);
  return createDocument(
    plain,
    { name: fileNameFor(doc), mime: doc.mime },
    {
      name: `${doc.name} (conflict copy)`,
      category: doc.category,
      docType: doc.doc_type,
      expiry: doc.expiry,
      fields: parseFields(doc),
      favorite: !!doc.favorite,
      notes: doc.notes,
      tags: parseTags(doc),
    },
  );
}

export const _internal = { utf8 };
