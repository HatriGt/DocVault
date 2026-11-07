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
import { scheduleReminders, cancelReminders } from './notifications';

const KEYFILE = 'vault.json';

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
export async function uploadKeyFile(kf: VaultKeyFile) {
  const existing = await Drive.findByName(KEYFILE);
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
    });
    if (prefs.expiryReminders && meta.expiry) scheduleReminders({ ...meta }).catch(() => {});
    return;
  }

  if (meta.updated_at <= local.updated_at) {
    // Our echo, or local is newer and will be pushed. Just record remote ids.
    if (!local.remote_meta_id) await updateDoc(local.id, { remote_meta_id: metaFileId }, true);
    return;
  }

  if (meta.deleted) {
    if (local.content_dirty) {
      // Edited here, deleted elsewhere: keep the user's data as a fresh document.
      await updateDoc(local.id, { remote_meta_id: null, remote_bin_id: null, meta_dirty: 1 });
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

async function pull() {
  const token = await kvGet<string | null>('sync.changesToken', null);
  if (!token) {
    const start = await Drive.getStartPageToken(); // take token first: no gap
    const metas = await Drive.listAll('.meta');
    for (const f of metas) if (f.name.endsWith('.meta')) await pullMetaFile(f.id, f.name);
    await kvSet('sync.changesToken', start);
    return;
  }
  const { changes, newStartPageToken } = await Drive.listChanges(token);
  for (const c of changes) {
    if (c.removed || !c.file || c.file.trashed) continue;
    if (!c.file.name.endsWith('.meta')) continue;
    await pullMetaFile(c.fileId, c.file.name);
  }
  await kvSet('sync.changesToken', newStartPageToken);
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
    const ct = await readBlob(doc.id);
    const bin = await Drive.upload({
      name: `${doc.id}.bin`,
      bytes: ct,
      existingId: doc.remote_bin_id,
      appProperties: { dv: 'bin', docId: doc.id },
      session: doc.upload_session,
      onSession: (uri) => updateDoc(doc.id, { upload_session: uri }, true),
    });
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
    const retryable = e instanceof DriveError ? e.retryable : true;
    await updateDoc(d.id, {
      sync_state: retryable && d.attempts < 5 ? failState : 'failed',
      last_error: msg,
      attempts: d.attempts + 1,
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
    setStatus({ running: true, lastError: null, progress: null });
    try {
      const pendingKf = await kvGet<VaultKeyFile | null>('keyfile.pending', null);
      if (pendingKf) await uploadKeyFile(pendingKf);

      await pull();

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
