/** High-level account/vault lifecycle used by onboarding and settings. */
import { createVault, destroyLocalKeys, restoreVault, rotateRecoveryKey, VaultKeyFile, lockKeysInMemory } from './keys';
import { clearTokens } from './google';
import { fetchRemoteKeyFile, queueKeyFile, syncNow, uploadKeyFile } from './sync';
import { setAccount, Account } from './session';
import { kvSet, wipeDatabase } from './db';
import { wipeAllBlobs } from './blobs';
import { cancelAllReminders } from './notifications';
import { unregisterBackgroundSync } from './backgroundSync';

export async function lookupExistingVault(): Promise<VaultKeyFile | null> {
  return fetchRemoteKeyFile();
}

export async function setUpNewVault(account: Account) {
  const { recoveryKey, keyFile } = await createVault();
  await setAccount(account);
  if (account.mode === 'google') {
    try {
      await uploadKeyFile(keyFile);
    } catch {
      await queueKeyFile(keyFile); // offline: upload on next sync
    }
  }
  return recoveryKey;
}

export async function restoreFromRecoveryKey(account: Account, keyFile: VaultKeyFile, recoveryKey: string) {
  await restoreVault(keyFile, recoveryKey);
  await setAccount(account);
  await kvSet('sync.changesToken', null);
  syncNow();
}

/** Connect Google Drive to an existing local-only vault. */
export async function connectDriveToLocalVault(account: Account) {
  const { recoveryKey, keyFile } = await rotateRecoveryKey();
  await uploadKeyFile(keyFile);
  await setAccount(account);
  // Mark every local document for upload.
  const { getDb } = await import('./db');
  const db = await getDb();
  await db.runAsync(
    "UPDATE documents SET content_dirty = 1, meta_dirty = 1, sync_state = 'upload_pending' WHERE sync_state = 'local_only'",
  );
  syncNow();
  return recoveryKey;
}

export async function newRecoveryKey() {
  const { recoveryKey, keyFile } = await rotateRecoveryKey();
  try {
    await uploadKeyFile(keyFile);
  } catch {
    await queueKeyFile(keyFile);
  }
  return recoveryKey;
}

/** Signs out and removes everything from this device. Cloud data is untouched. */
export async function signOutAndWipeDevice() {
  await unregisterBackgroundSync();
  await cancelAllReminders().catch(() => {});
  wipeAllBlobs();
  await wipeDatabase();
  await destroyLocalKeys();
  await clearTokens();
  lockKeysInMemory();
  await setAccount(null);
}

/** Deletes every DocVault file in the user's appDataFolder (irreversible). */
export async function resetRemoteVault() {
  const { listAll, remove } = await import('./drive');
  for (const f of await listAll()) await remove(f.id);
  await kvSet('sync.changesToken', null);
}
