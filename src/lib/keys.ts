/**
 * Vault key management. The VMK lives only in the platform secure enclave
 * wrapper (iOS Keychain / Android Keystore via expo-secure-store) and in
 * memory while the app is unlocked. A copy wrapped by the recovery key is
 * stored remotely so a lost device can be recovered — never in plaintext.
 */
import * as SecureStore from 'expo-secure-store';
import {
  deriveKek,
  fromB64,
  generateRecoveryKey,
  KdfParams,
  newKdfParams,
  newKey,
  normalizeRecoveryKey,
  open,
  seal,
  timingSafeEqual,
  toB64,
  utf8,
  randomBytes,
} from './crypto';

const VMK_KEY = 'dv.vmk.v1';
const PIN_KEY = 'dv.pin.v1';
const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let cachedVmk: Uint8Array | null = null;

/** Remote key file (Drive appDataFolder/vault.json). Safe to store in the cloud. */
export interface VaultKeyFile {
  v: 1;
  kdf: KdfParams;
  wrappedVmk: string; // b64 envelope
  createdAt: number;
}

export async function hasLocalVaultKey() {
  return (await SecureStore.getItemAsync(VMK_KEY, STORE_OPTS)) != null;
}

export async function getVmk(): Promise<Uint8Array> {
  if (cachedVmk) return cachedVmk;
  const b64 = await SecureStore.getItemAsync(VMK_KEY, STORE_OPTS);
  if (!b64) throw new Error('Vault is not set up on this device');
  cachedVmk = fromB64(b64);
  return cachedVmk;
}

export function lockKeysInMemory() {
  cachedVmk = null;
}

async function persistVmk(vmk: Uint8Array) {
  await SecureStore.setItemAsync(VMK_KEY, toB64(vmk), STORE_OPTS);
  cachedVmk = vmk;
}

/** Creates a new vault. Returns the recovery key (show once) and the cloud key file. */
export async function createVault(): Promise<{ recoveryKey: string; keyFile: VaultKeyFile }> {
  const vmk = newKey();
  const recoveryKey = generateRecoveryKey();
  const keyFile = await wrapForRecovery(vmk, recoveryKey);
  await persistVmk(vmk);
  return { recoveryKey, keyFile };
}

export async function wrapForRecovery(vmk: Uint8Array, recoveryKey: string): Promise<VaultKeyFile> {
  const kdf = newKdfParams();
  const kek = await deriveKek(normalizeRecoveryKey(recoveryKey), kdf);
  return { v: 1, kdf, wrappedVmk: toB64(seal(kek, vmk, 'vmk')), createdAt: Date.now() };
}

/** Re-key recovery: generates a new recovery key for the existing VMK. */
export async function rotateRecoveryKey() {
  const vmk = await getVmk();
  const recoveryKey = generateRecoveryKey();
  return { recoveryKey, keyFile: await wrapForRecovery(vmk, recoveryKey) };
}

/** Restores the vault on a new device. Throws if the recovery key is wrong. */
export async function restoreVault(keyFile: VaultKeyFile, recoveryKey: string) {
  const kek = await deriveKek(normalizeRecoveryKey(recoveryKey), keyFile.kdf);
  let vmk: Uint8Array;
  try {
    vmk = open(kek, fromB64(keyFile.wrappedVmk), 'vmk');
  } catch {
    throw new Error('That recovery key doesn’t match this vault.');
  }
  await persistVmk(vmk);
}

// ---------- per-document keys ----------
export async function newWrappedDek(docId: string) {
  const dek = newKey();
  const vmk = await getVmk();
  return { dek, wrapped: toB64(seal(vmk, dek, `dek:${docId}`)) };
}

export async function unwrapDek(docId: string, wrapped: string) {
  const vmk = await getVmk();
  return open(vmk, fromB64(wrapped), `dek:${docId}`);
}

// ---------- PIN ----------
export async function setPin(pin: string) {
  const salt = randomBytes(16);
  const kek = await deriveKek(pin, { alg: 'scrypt', salt: toB64(salt), N: 2 ** 14, r: 8, p: 1 });
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt: toB64(salt), h: toB64(kek) }), STORE_OPTS);
}

export async function hasPin() {
  return (await SecureStore.getItemAsync(PIN_KEY, STORE_OPTS)) != null;
}

export async function verifyPin(pin: string) {
  const raw = await SecureStore.getItemAsync(PIN_KEY, STORE_OPTS);
  if (!raw) return false;
  const { salt, h } = JSON.parse(raw);
  const kek = await deriveKek(pin, { alg: 'scrypt', salt, N: 2 ** 14, r: 8, p: 1 });
  return timingSafeEqual(kek, fromB64(h));
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(PIN_KEY, STORE_OPTS);
}

export async function destroyLocalKeys() {
  cachedVmk = null;
  await SecureStore.deleteItemAsync(VMK_KEY, STORE_OPTS);
  await SecureStore.deleteItemAsync(PIN_KEY, STORE_OPTS);
}

export const _test = { utf8 };
