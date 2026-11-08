/**
 * Offline-first bidirectional sync engine.
 *
 * The local SQLite database is the source of truth for the UI. Drive is a
 * replica that holds, inside the hidden appDataFolder:
 *   vault.json        – VMK wrapped by the recovery key (KDF params + envelope)
 *   <docId>.meta      – metadata JSON sealed with the VMK
 *   <docId>.bin       – document ciphertext (sealed with the per-doc DEK)
 *
 * Cycle: pull remote changes → resolve conflicts → push local edits →
 * download blobs for documents kept offline. Every step is idempotent and
 * state is persisted per document, so an interrupted run simply resumes.
 */
import NetInfo from '@react-native-community/netinfo';
import { fromB64, openJson, sealJson, toB64 } from './crypto';
import { getVmk, VaultKeyFile } from './keys';
import * as Drive from './drive';
import { DriveError } from './drive';
import { AuthRequiredError } from './google';
import { deleteBlob, hasBlob, readBlob, writeBlob } from './blobs';
import {
  DocRecord,
  docsNeedingDownload,
  docsNeedingPush,
  getDoc,
  hardDeleteDoc,
  insertDoc,
  kvGet,
  kvSet,
  updateDoc,
} from './db';
import { emit } from './events';
import { getAccount, getPrefs } from './session';
import { duplicateAsConflictCopy } from './documents';
import { registerSyncRunner } from './syncQueue';
import { allFoldersIncludingDeleted, Folder, mergeFolders } from './folders';
import { scheduleReminders, cancelReminders } from './notifications';

const KEYFILE = 'vault.json';
const FOLDERS_FILE = 'folders.dvf';

async function pullFolders(fileId: string) {
  const bytes = await Drive.download(fileId);
  try {
    const list = openJson<Folder[]>(await getVmk(), bytes, 'folders');
    await mergeFolders(list);
  } catch {
    console.warn('[sync] skipping undecryptable folders file');
  }
}

async function pushFoldersIfDirty() {
  if (!(await kvGet<boolean>('folders.dirty', false))) return;
  const existing = await Drive.findByName(FOLDERS_FILE);
  if (existing) await pullFolders(existing.id); // merge first so we never clobber another device
  const all = await allFoldersIncludingDeleted();
  await Drive.upload({
    name: FOLDERS_FILE,
    bytes: sealJson(await getVmk(), all, 'folders'),
    existingId: existing?.id,
    appProperties: { dv: 'folders' },
  });
  await kvSet('folders.dirty', false);
}

/** Fields replicated through the encrypted .meta file. */
interface RemoteMeta {
  v: 1;
  id: string;
  name: string;
  category: string;
  doc_type: string | null;
  mime: string;
  ext: string;
  size: number;
  created_at: number;
  updated_at: number;
  expiry: string | null;
  favorite: number;
  pinned: number;
  fields: string;
  notes: string | null;
  tags?: string; // optional for metas written before tags existed
  folder_id?: string | null;
  trashed_at?: number | null;
  locked?: number;
  wrapped_dek: string;
  content_hash: string | null;
  bin_id: string | null;
  deleted: number;
}

export interface SyncStatus {
  running: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  progress: { done: number; total: number } | null;
  online: boolean;
}

let status: SyncStatus = { running: false, lastSyncAt: null, lastError: null, progress: null, online: true };
let current: Promise<void> | null = null;

export const getSyncStatus = () => status;
function setStatus(p: Partial<SyncStatus>) {
  status = { ...status, ...p };
  emit('sync');
}

export async function initSyncStatus() {
  const last = await kvGet<number | null>('sync.lastAt', null);
  const net = await NetInfo.fetch();
  setStatus({ lastSyncAt: last, online: !!net.isConnected });
}

// ---------- key file ----------
export class VaultConflictError extends Error {}

export async function uploadKeyFile(kf: VaultKeyFile) {
  const existing = await Drive.findByName(KEYFILE);
  if (existing && kf.vaultId) {
    // Never replace a key file that belongs to a different vault (e.g. queued offline, then the
    // account got a new vault elsewhere) — that would make the other vault unrecoverable.
    try {
      const remote = JSON.parse(new TextDecoder().decode(await Drive.download(existing.id))) as VaultKeyFile;
      if (remote.vaultId && remote.vaultId !== kf.vaultId) throw new VaultConflictError('This Google account now holds a different vault.');
    } catch (e) {
      if (e instanceof VaultConflictError) throw e;
    }
  }
  await Drive.upload({
    name: KEYFILE,
    bytes: new TextEncoder().encode(JSON.stringify(kf)),
    existingId: existing?.id,
    appProperties: { dv: 'keyfile' },
  });
  await kvSet('keyfile.pending', null);
}

/** Queues a key file for upload (e.g. created while offline). */
export const queueKeyFile = (kf: VaultKeyFile) => kvSet('keyfile.pending', kf);

export async function fetchRemoteKeyFile(): Promise<VaultKeyFile | null> {
  const f = await Drive.findByName(KEYFILE);
  if (!f) return null;
  const bytes = await Drive.download(f.id);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ---------- meta encode/decode ----------
async function encodeMeta(d: DocRecord): Promise<Uint8Array> {
  const m: RemoteMeta = {
    v: 1,
    id: d.id,
    name: d.name,
    category: d.category,
    doc_type: d.doc_type,
    mime: d.mime,
    ext: d.ext,
    size: d.size,
    created_at: d.created_at,
    updated_at: d.updated_at,
    expiry: d.expiry,
    favorite: d.favorite,
    pinned: d.pinned,
    fields: d.fields,
    notes: d.notes,
    tags: d.tags,
    folder_id: d.folder_id,
    trashed_at: d.trashed_at,
    locked: d.locked,
    wrapped_dek: d.wrapped_dek,
    content_hash: d.content_hash,
    bin_id: d.remote_bin_id,
    deleted: d.deleted,
  };
  return sealJson(await getVmk(), m, `meta:${d.id}`);
}

async function decodeMeta(docId: string, bytes: Uint8Array): Promise<RemoteMeta> {
  return openJson<RemoteMeta>(await getVmk(), bytes, `meta:${docId}`);
}

// ---------- pull ----------
async function applyRemote(meta: RemoteMeta, metaFileId: string) {
  const local = await getDoc(meta.id);
  const prefs = await getPrefs();

  if (!local) {
    if (meta.deleted) return;
    await insertDoc({
      id: meta.id,
      name: meta.name,
      category: meta.category,
      doc_type: meta.doc_type,
      mime: meta.mime,
      ext: meta.ext,
      size: meta.size,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      accessed_at: null,
      expiry: meta.expiry,
      favorite: meta.favorite,
      pinned: meta.pinned,
      offline_pref: prefs.offlineDefault,
      has_local: 0,
      sync_state: prefs.offlineDefault === 'keep' ? 'download_pending' : 'synced',
      content_dirty: 0,
      meta_dirty: 0,
      deleted: 0,
      wrapped_dek: meta.wrapped_dek,
      content_hash: meta.content_hash,
      remote_meta_id: metaFileId,
      remote_bin_id: meta.bin_id,
      upload_session: null,
      last_synced_at: Date.now(),
      last_error: null,
      attempts: 0,
      fields: meta.fields,
      back_id: null,
      notes: meta.notes,
      tags: meta.tags ?? '[]',
      folder_id: meta.folder_id ?? null,
      trashed_at: meta.trashed_at ?? null,
      locked: meta.locked ?? 0,
      plain_hash: null,
    });
    if (prefs.expiryReminders && meta.expiry && !meta.trashed_at) scheduleReminders({ ...meta }).catch(() => {});
    return;
  }

  if (meta.updated_at <= local.updated_at) {
    // Our echo, or local is newer and will be pushed. Just record remote ids.
    if (!local.remote_meta_id) await updateDoc(local.id, { remote_meta_id: metaFileId }, true);
    return;
  }

  if (meta.deleted) {
    if (local.content_dirty) {
      // Edited here, deleted elsewhere: keep the user's data. Overwrite the tombstone file (same id)
      // with a newer timestamp so a freshly restoring device can't apply the deletion over it.
      await updateDoc(local.id, { remote_meta_id: metaFileId, remote_bin_id: null, meta_dirty: 1, content_dirty: 1, updated_at: Date.now() });
      return;
    }
    deleteBlob(local.id);
    cancelReminders(local.id).catch(() => {});
    await hardDeleteDoc(local.id);
    return;
  }

  const contentChanged = meta.content_hash !== local.content_hash;
  if (local.content_dirty && contentChanged) {
    // True content conflict: never lose data. Preserve local as a copy.
    if (hasBlob(local.id)) await duplicateAsConflictCopy(local);
  }

  // Remote wins (last-writer-wins on metadata).
  if (contentChanged) deleteBlob(local.id);
  const hasLocal = contentChanged ? 0 : local.has_local;
  await updateDoc(local.id, {
    name: meta.name,
    category: meta.category,
    doc_type: meta.doc_type,
    mime: meta.mime,
    ext: meta.ext,
    size: meta.size,
    updated_at: meta.updated_at,
    expiry: meta.expiry,
    favorite: meta.favorite,
    pinned: meta.pinned,
    fields: meta.fields,
    notes: meta.notes,
    tags: meta.tags ?? local.tags,
    folder_id: meta.folder_id !== undefined ? meta.folder_id : local.folder_id,
    trashed_at: meta.trashed_at !== undefined ? meta.trashed_at : local.trashed_at,
    locked: meta.locked ?? local.locked,
    wrapped_dek: meta.wrapped_dek,
    content_hash: meta.content_hash,
    remote_meta_id: metaFileId,
    remote_bin_id: meta.bin_id,
    has_local: hasLocal,
    content_dirty: 0,
    meta_dirty: 0,
    upload_session: null,
    sync_state: !hasLocal && local.offline_pref === 'keep' ? 'download_pending' : 'synced',
    last_synced_at: Date.now(),
    last_error: null,
  });
  const nowTrashed = meta.trashed_at !== undefined ? meta.trashed_at : local.trashed_at;
  if (nowTrashed) {
    cancelReminders(local.id).catch(() => {});
  } else if (prefs.expiryReminders && (local.trashed_at || meta.expiry !== local.expiry || meta.name !== local.name)) {
    scheduleReminders({ id: local.id, name: meta.name, expiry: meta.expiry, doc_type: meta.doc_type }).catch(() => {});
  }
}

async function pullMetaFile(fileId: string, name: string) {
  const docId = name.replace(/\.meta$/, '');
  const bytes = await Drive.download(fileId);
  let meta: RemoteMeta;
  try {
    meta = await decodeMeta(docId, bytes);
  } catch {
    // Not decryptable with this vault key (e.g. leftovers from a reset vault). Skip, never crash sync.
    console.warn(`[sync] skipping undecryptable metadata ${name}`);
    return;
  }
  await applyRemote(meta, fileId);
}

/** Pulls one meta file; returns false (without throwing) if it couldn't be applied. */
async function tryPull(fileId: string, name: string) {
  try {
    await pullMetaFile(fileId, name);
    return true;
  } catch (e) {
    if (e instanceof AuthRequiredError || (e instanceof DriveError && e.status === 0)) throw e;
    console.warn(`[sync] could not apply ${name}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function pull() {
  const token = await kvGet<string | null>('sync.changesToken', null);
  if (!token) {
    const start = await Drive.getStartPageToken(); // take token first: no gap
    // Drive's `name contains` only matches prefixes, so filter by our appProperties tag instead.
    const metas = await Drive.listAll("appProperties has { key='dv' and value='meta' } and trashed = false");
    let ok = true;
    for (const f of metas) if (f.name.endsWith('.meta')) ok = (await tryPull(f.id, f.name)) && ok;
    const ff = await Drive.findByName(FOLDERS_FILE);
    if (ff) await pullFolders(ff.id);
    if (ok) await kvSet('sync.changesToken', start); // otherwise retry the full pull next time
    return;
  }
  const { changes, newStartPageToken } = await Drive.listChanges(token);
  let ok = true;
  for (const c of changes) {
    if (c.removed || !c.file || c.file.trashed) continue;
    if (c.file.name === FOLDERS_FILE) {
      await pullFolders(c.fileId);
      continue;
    }
    if (!c.file.name.endsWith('.meta')) continue;
    ok = (await tryPull(c.fileId, c.file.name)) && ok;
  }
  // Only move the bookmark forward when every change was applied; failures are retried next run.
  if (ok) await kvSet('sync.changesToken', newStartPageToken);
}

// ---------- push ----------
async function pushDoc(d: DocRecord) {
  await updateDoc(d.id, { sync_state: 'syncing' });
  let doc = d;

  if (doc.deleted) {
    if (doc.remote_bin_id) await Drive.remove(doc.remote_bin_id);
    const metaBytes = await encodeMeta({ ...doc, remote_bin_id: null });
    await Drive.upload({
      name: `${doc.id}.meta`,
      bytes: metaBytes,
      existingId: doc.remote_meta_id,
      appProperties: { dv: 'meta', docId: doc.id, deleted: '1' },
    });
    await hardDeleteDoc(doc.id);
    return;
  }

  if (doc.content_dirty) {
    const uploadedHash = doc.content_hash;
    const ct = await readBlob(doc.id);
    const bin = await Drive.upload({
      name: `${doc.id}.bin`,
      bytes: ct,
      existingId: doc.remote_bin_id,
      appProperties: { dv: 'bin', docId: doc.id },
      session: doc.upload_session,
      onSession: (uri) => updateDoc(doc.id, { upload_session: uri }, true),
    });
    const latest = await getDoc(doc.id);
    if (latest && latest.content_hash !== uploadedHash) {
      // Content changed while uploading: keep it dirty and push the new version next cycle.
      await updateDoc(doc.id, { remote_bin_id: bin.id, upload_session: null, sync_state: 'upload_pending' }, true);
      return;
    }
    await updateDoc(doc.id, { remote_bin_id: bin.id, content_dirty: 0, upload_session: null }, true);
    doc = (await getDoc(doc.id))!;
  }

  const metaBytes = await encodeMeta(doc);
  const meta = await Drive.upload({
    name: `${doc.id}.meta`,
    bytes: metaBytes,
    existingId: doc.remote_meta_id,
    appProperties: { dv: 'meta', docId: doc.id, updatedAt: String(doc.updated_at) },
  });
  // If the user edited during upload, keep meta_dirty so the next cycle pushes again.
  const latest = await getDoc(doc.id);
  const editedMeanwhile = latest && latest.updated_at !== doc.updated_at;
  await updateDoc(doc.id, {
    remote_meta_id: meta.id,
    meta_dirty: editedMeanwhile ? 1 : 0,
    sync_state: editedMeanwhile ? 'upload_pending' : 'synced',
    last_synced_at: Date.now(),
    last_error: null,
    attempts: 0,
  });
}

// ---------- downloads ----------
async function downloadDoc(d: DocRecord) {
  await updateDoc(d.id, { sync_state: 'syncing' });
  const ct = await Drive.download(d.remote_bin_id!);
  await writeBlob(d.id, ct);
  await updateDoc(d.id, { has_local: 1, sync_state: 'synced', last_error: null, attempts: 0 });
}

async function withDocErrors(d: DocRecord, fn: () => Promise<void>, failState: DocRecord['sync_state']) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AuthRequiredError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    const isDrive = e instanceof DriveError;
    const retryable = isDrive ? e.retryable : true;
    const attempts = isDrive ? d.attempts + 1 : d.attempts; // local hiccups never exhaust retries
    await updateDoc(d.id, {
      sync_state: retryable && attempts < 5 ? failState : 'failed',
      last_error: msg,
      attempts,
    });
    if (e instanceof DriveError && e.status === 0) throw e; // offline: stop the cycle
  }
}

// ---------- orchestrator ----------
export async function canSync(): Promise<boolean> {
  const account = await getAccount();
  if (account?.mode !== 'google') return false;
  const net = await NetInfo.fetch();
  setStatus({ online: !!net.isConnected });
  if (!net.isConnected) return false;
  const prefs = await getPrefs();
  if (prefs.wifiOnly && net.type !== 'wifi') return false;
  return true;
}

export function syncNow(): Promise<void> {
  if (current) return current;
  current = (async () => {
    if (!(await canSync())) return;
    try {
      await getVmk(); // e.g. iPhone locked during a background run → don't touch anything
    } catch {
      setStatus({ lastError: 'Unlock your phone to finish syncing.' });
      return;
    }
    setStatus({ running: true, lastError: null, progress: null });
    try {
      const pendingKf = await kvGet<VaultKeyFile | null>('keyfile.pending', null);
      if (pendingKf) {
        try {
          await uploadKeyFile(pendingKf);
        } catch (e) {
          if (!(e instanceof VaultConflictError)) throw e;
          await kvSet('keyfile.pending', null);
          setStatus({ lastError: 'This Google account has a different vault. Sign out and restore it, or use another account.' });
          return;
        }
      }

      await pull();
      await pushFoldersIfDirty();

      const toPush = await docsNeedingPush();
      const toFetch = await docsNeedingDownload();
      const total = toPush.length + toFetch.length;
      let done = 0;
      setStatus({ progress: total ? { done, total } : null });

      for (const d of toPush) {
        await withDocErrors(d, () => pushDoc(d), 'upload_pending');
        setStatus({ progress: { done: ++done, total } });
      }
      for (const d of await docsNeedingDownload()) {
        await withDocErrors(d, () => downloadDoc(d), 'download_pending');
        setStatus({ progress: { done: ++done, total } });
      }
      const now = Date.now();
      await kvSet('sync.lastAt', now);
      setStatus({ lastSyncAt: now });
    } catch (e) {
      const msg =
        e instanceof AuthRequiredError
          ? 'Sign in to Google again to resume sync.'
          : e instanceof DriveError && e.status === 0
            ? 'Offline — changes will sync when you reconnect.'
            : e instanceof Error
              ? e.message
              : 'Sync failed';
      setStatus({ lastError: msg });
    } finally {
      setStatus({ running: false, progress: null });
      current = null;
    }
  })();
  return current;
}

/** Retry documents that permanently failed. */
export async function retryFailed(docs: DocRecord[]) {
  for (const d of docs) {
    await updateDoc(d.id, {
      attempts: 0,
      sync_state: d.content_dirty || d.meta_dirty ? 'upload_pending' : 'download_pending',
    });
  }
  return syncNow();
}

/** Start background-friendly listeners: reconnect → sync. */
export function startSyncListeners() {
  registerSyncRunner(async () => {
    if ((await getPrefs()).autoSync) await syncNow();
  });
  return NetInfo.addEventListener((s) => {
    const wasOnline = status.online;
    setStatus({ online: !!s.isConnected });
    if (!wasOnline && s.isConnected) {
      getPrefs().then((p) => {
        if (p.autoSync) syncNow();
      });
    }
  });
}

export const _codec = { toB64, fromB64 };
