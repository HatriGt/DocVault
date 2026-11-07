/**
 * Folders and subfolders. Unlimited nesting via parent_id. Folders sync as one
 * encrypted file on Drive, merged per folder (last writer wins, tombstones for
 * deletions). Deleting a folder never deletes documents: they move up a level.
 */
import { getDb, kvSet, updateDoc } from './db';
import { emit } from './events';
import { uuid } from './crypto';
import { requestSync } from './syncQueue';
import { logActivity } from './activity';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  icon: string;
  created_at: number;
  updated_at: number;
  deleted: number;
}

export const FOLDER_COLORS = ['#15171B', '#B08A5B', '#2F7D5B', '#3E5A7A', '#8C4A3F', '#6B5B95', '#5E6B4E', '#A0705A'];
export const FOLDER_ICONS = [
  'folder',
  'airplane',
  'briefcase',
  'home',
  'car-sport',
  'school',
  'medkit',
  'card',
  'people',
  'receipt',
  'heart',
  'paw',
] as const;

const markDirty = async () => {
  await kvSet('folders.dirty', true);
  emit('documents');
  requestSync();
};

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAllAsync<Folder>('SELECT * FROM folders WHERE deleted = 0 ORDER BY name COLLATE NOCASE');
}

export async function allFoldersIncludingDeleted(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAllAsync<Folder>('SELECT * FROM folders');
}

export async function createFolder(name: string, parentId: string | null, color = FOLDER_COLORS[0], icon = 'folder') {
  const db = await getDb();
  const now = Date.now();
  const f: Folder = { id: uuid(), name: name.trim() || 'New folder', parent_id: parentId, color, icon, created_at: now, updated_at: now, deleted: 0 };
  await db.runAsync(
    'INSERT INTO folders (id,name,parent_id,color,icon,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,?,0)',
    f.id, f.name, f.parent_id, f.color, f.icon, f.created_at, f.updated_at,
  );
  await markDirty();
  return f;
}

export async function updateFolder(id: string, patch: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'parent_id'>>) {
  const db = await getDb();
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  await db.runAsync(
    `UPDATE folders SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...keys.map((k) => patch[k] ?? null),
    Date.now(),
    id,
  );
  await markDirty();
}

/** True if `candidate` is `folderId` or one of its descendants (prevents cycles). */
export function isWithin(folders: Folder[], candidate: string | null, folderId: string) {
  let cur = candidate;
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (let guard = 0; cur && guard < 64; guard++) {
    if (cur === folderId) return true;
    cur = byId.get(cur)?.parent_id ?? null;
  }
  return false;
}

export async function moveFolder(id: string, newParent: string | null) {
  const folders = await listFolders();
  if (newParent && isWithin(folders, newParent, id)) throw new Error('A folder can’t be moved into itself.');
  await updateFolder(id, { parent_id: newParent });
}

/** Deletes a folder; its subfolders and documents move to the parent. */
export async function deleteFolder(id: string) {
  const db = await getDb();
  const f = await db.getFirstAsync<Folder>('SELECT * FROM folders WHERE id = ?', id);
  if (!f) return;
  const now = Date.now();
  await db.runAsync('UPDATE folders SET parent_id = ?, updated_at = ? WHERE parent_id = ? AND deleted = 0', f.parent_id, now, id);
  const docs = await db.getAllAsync<{ id: string }>('SELECT id FROM documents WHERE folder_id = ? AND deleted = 0', id);
  for (const d of docs) await moveDocument(d.id, f.parent_id, true);
  await db.runAsync('UPDATE folders SET deleted = 1, updated_at = ? WHERE id = ?', now, id);
  await markDirty();
}

export async function moveDocument(docId: string, folderId: string | null, silent = false) {
  const db = await getDb();
  const doc = await db.getFirstAsync<{ sync_state: string }>('SELECT sync_state FROM documents WHERE id = ?', docId);
  if (!doc) return;
  const cloud = doc.sync_state !== 'local_only';
  await updateDoc(
    docId,
    {
      folder_id: folderId,
      updated_at: Date.now(),
      ...(cloud ? { meta_dirty: 1, sync_state: doc.sync_state === 'synced' ? 'upload_pending' : (doc.sync_state as never) } : {}),
    },
    silent,
  );
  logActivity(docId, 'moved');
  if (!silent) requestSync();
}

/** Breadcrumb trail from the root to `id` (inclusive). */
export function pathTo(folders: Folder[], id: string | null): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: Folder[] = [];
  let cur = id ? byId.get(id) : undefined;
  for (let guard = 0; cur && guard < 64; guard++) {
    out.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return out;
}

/** Merges a remote folder list into the local table (per-folder last writer wins). */
export async function mergeFolders(remote: Folder[]) {
  const db = await getDb();
  const local = new Map((await allFoldersIncludingDeleted()).map((f) => [f.id, f]));
  let changed = false;
  for (const r of remote) {
    const l = local.get(r.id);
    if (l && l.updated_at >= r.updated_at) continue;
    await db.runAsync(
      'INSERT OR REPLACE INTO folders (id,name,parent_id,color,icon,created_at,updated_at,deleted) VALUES (?,?,?,?,?,?,?,?)',
      r.id, r.name, r.parent_id, r.color, r.icon, r.created_at, r.updated_at, r.deleted,
    );
    changed = true;
  }
  if (changed) emit('documents');
  // If we have anything newer than remote, make sure it gets pushed.
  const remoteIds = new Map(remote.map((r) => [r.id, r.updated_at]));
  for (const l of local.values()) {
    const ru = remoteIds.get(l.id);
    if (ru == null || l.updated_at > ru) {
      await kvSet('folders.dirty', true);
      break;
    }
  }
}
