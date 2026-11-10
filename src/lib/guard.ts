/** Biometric gate for documents marked "Locked". Unlock lasts 2 minutes per document. */
import * as LocalAuthentication from 'expo-local-authentication';
import type { DocRecord } from './db';

const unlockedUntil = new Map<string, number>();

export function isUnlocked(doc: Pick<DocRecord, 'id' | 'locked'>) {
  return !doc.locked || (unlockedUntil.get(doc.id) ?? 0) > Date.now();
}

export async function unlockDoc(doc: Pick<DocRecord, 'id' | 'locked' | 'name'>): Promise<boolean> {
  if (isUnlocked(doc)) return true;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: `Unlock “${doc.name}”`, disableDeviceFallback: false });
  if (r.success) unlockedUntil.set(doc.id, Date.now() + 120_000);
  return r.success;
}

export function relockAll() {
  unlockedUntil.clear();
}
