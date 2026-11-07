/**
 * Local encrypted blob store. Files on disk are always ciphertext (the exact
 * bytes uploaded to Drive). Plaintext only ever exists transiently in the
 * cache "open" directory while the user views/shares, and is purged after.
 */
import { Directory, File, Paths } from 'expo-file-system';

const vaultDir = () => new Directory(Paths.document, 'vault');
const openDir = () => new Directory(Paths.cache, 'open');

function ensure(dir: Directory) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function blobFile(docId: string) {
  return new File(ensure(vaultDir()), `${docId}.dvk`);
}

export async function writeBlob(docId: string, bytes: Uint8Array) {
  const f = blobFile(docId);
  const tmp = new File(ensure(vaultDir()), `${docId}.dvk.part`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.writeSync(bytes);
  if (f.exists) f.delete();
  tmp.moveSync(f); // atomic-ish replace: never leaves a truncated blob
}

export async function readBlob(docId: string) {
  const f = blobFile(docId);
  if (!f.exists) throw new Error('This document is not stored on this device.');
  return f.bytes();
}

export function hasBlob(docId: string) {
  return blobFile(docId).exists;
}

export function deleteBlob(docId: string) {
  const f = blobFile(docId);
  if (f.exists) f.delete();
}

export function localVaultBytes() {
  const d = vaultDir();
  if (!d.exists) return 0;
  return d.list().reduce((sum, e) => sum + (e instanceof File ? e.size ?? 0 : 0), 0);
}

/** Writes decrypted bytes to a short-lived file for viewing/sharing. */
export function writeTempPlain(fileName: string, bytes: Uint8Array) {
  const dir = ensure(openDir());
  const safe = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const f = new File(dir, safe);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(bytes);
  return f;
}

export function purgeTempPlain() {
  const d = openDir();
  if (d.exists) d.delete();
}

export function wipeAllBlobs() {
  const d = vaultDir();
  if (d.exists) d.delete();
  purgeTempPlain();
}
