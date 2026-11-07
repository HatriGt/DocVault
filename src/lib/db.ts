import * as SQLite from 'expo-sqlite';
import { emit } from './events';

export type SyncState =
  | 'synced'
  | 'syncing'
  | 'upload_pending'
  | 'download_pending'
  | 'failed'
  | 'local_only';

export type OfflinePref = 'keep' | 'cloud';

export interface DocRecord {
  id: string;
  name: string;
  category: string;
  doc_type: string | null;
  mime: string;
  ext: string;
  size: number;
  created_at: number;
  updated_at: number;
  accessed_at: number | null;
  expiry: string | null; // ISO date (yyyy-mm-dd)
  favorite: number;
  pinned: number;
  offline_pref: OfflinePref;
  has_local: number; // encrypted blob present on device
  sync_state: SyncState;
  content_dirty: number;
  meta_dirty: number;
  deleted: number;
  wrapped_dek: string; // b64, DEK sealed with VMK
  content_hash: string | null; // sha256 of ciphertext
  remote_meta_id: string | null;
  remote_bin_id: string | null;
  upload_session: string | null; // resumable upload URI (survives restarts)
  last_synced_at: number | null;
  last_error: string | null;
  attempts: number;
  fields: string; // JSON: holder, number, issuer, country...
  back_id: string | null; // optional linked doc id for card back side
  notes: string | null;
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  hue: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    doc_type TEXT,
    mime TEXT NOT NULL,
    ext TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    accessed_at INTEGER,
    expiry TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    offline_pref TEXT NOT NULL DEFAULT 'keep',
    has_local INTEGER NOT NULL DEFAULT 0,
    sync_state TEXT NOT NULL DEFAULT 'local_only',
    content_dirty INTEGER NOT NULL DEFAULT 0,
    meta_dirty INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    wrapped_dek TEXT NOT NULL,
    content_hash TEXT,
    remote_meta_id TEXT,
    remote_bin_id TEXT,
    upload_session TEXT,
    last_synced_at INTEGER,
    last_error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    fields TEXT NOT NULL DEFAULT '{}',
    back_id TEXT,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_docs_cat ON documents(category);
  CREATE INDEX IF NOT EXISTS idx_docs_state ON documents(sync_state);
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, icon TEXT NOT NULL, hue TEXT NOT NULL
  );`,
];

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('docvault.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      let version = row?.user_version ?? 0;
      while (version < MIGRATIONS.length) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(MIGRATIONS[version]);
          await db.execAsync(`PRAGMA user_version = ${version + 1}`);
        });
        version++;
      }
      return db;
    })();
  }
  return dbPromise;
}

// ---------- key/value settings ----------
export async function kvGet<T>(k: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k);
  return row ? (JSON.parse(row.v) as T) : fallback;
}
export async function kvSet(k: string, v: unknown) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, JSON.stringify(v));
}

// ---------- documents ----------
export async function listDocs(): Promise<DocRecord[]> {
  const db = await getDb();
  return db.getAllAsync<DocRecord>('SELECT * FROM documents WHERE deleted = 0 ORDER BY created_at DESC');
}

export async function getDoc(id: string): Promise<DocRecord | null> {
  const db = await getDb();
  return db.getFirstAsync<DocRecord>('SELECT * FROM documents WHERE id = ?', id);
}

export async function insertDoc(doc: DocRecord) {
  const db = await getDb();
  const keys = Object.keys(doc) as (keyof DocRecord)[];
  await db.runAsync(
    `INSERT OR REPLACE INTO documents (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
    ...keys.map((k) => doc[k] as SQLite.SQLiteBindValue),
  );
  emit('documents');
}

export async function updateDoc(id: string, patch: Partial<DocRecord>, silent = false) {
  const keys = Object.keys(patch) as (keyof DocRecord)[];
  if (!keys.length) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE documents SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    ...keys.map((k) => patch[k] as SQLite.SQLiteBindValue),
    id,
  );
  if (!silent) emit('documents');
}

export async function hardDeleteDoc(id: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
  emit('documents');
}

export async function docsNeedingPush(): Promise<DocRecord[]> {
  const db = await getDb();
  return db.getAllAsync<DocRecord>(
    'SELECT * FROM documents WHERE content_dirty = 1 OR meta_dirty = 1 ORDER BY updated_at ASC',
  );
}

export async function docsNeedingDownload(): Promise<DocRecord[]> {
  const db = await getDb();
  return db.getAllAsync<DocRecord>(
    `SELECT * FROM documents WHERE deleted = 0 AND has_local = 0 AND offline_pref = 'keep'
     AND remote_bin_id IS NOT NULL`,
  );
}

// ---------- custom categories ----------
export async function listCustomCategories(): Promise<CustomCategory[]> {
  const db = await getDb();
  return db.getAllAsync<CustomCategory>('SELECT * FROM categories ORDER BY name');
}
export async function addCustomCategory(c: CustomCategory) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO categories (id,name,icon,hue) VALUES (?,?,?,?)', c.id, c.name, c.icon, c.hue);
  emit('documents');
}

export async function wipeDatabase() {
  const db = await getDb();
  await db.execAsync('DELETE FROM documents; DELETE FROM kv; DELETE FROM categories;');
  emit('documents');
}
