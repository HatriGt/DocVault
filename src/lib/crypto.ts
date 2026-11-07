/**
 * Client-side cryptography for DocVault.
 *
 * Key hierarchy (zero-knowledge):
 *   Recovery Key (shown once to the user, never stored remotely in plaintext)
 *     └─ scrypt ─▶ KEK ─ wraps ─▶ Vault Master Key (VMK, 256-bit random)
 *   VMK (kept in iOS Keychain / Android Keystore-backed SecureStore)
 *     └─ wraps ─▶ per-document Data Encryption Key (DEK, 256-bit random)
 *   DEK ─ AES-256-GCM ─▶ document bytes
 *
 * Google Drive only ever receives: ciphertext blobs, encrypted metadata and
 * the VMK wrapped by the recovery-key-derived KEK. Signing into Google alone
 * can never reveal any key material.
 */
import QuickCrypto from 'react-native-quick-crypto';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { getRandomBytes } from 'expo-crypto';

const MAGIC = new Uint8Array([0x44, 0x56, 0x4b, 0x31]); // "DVK1"
const NONCE_LEN = 12;
const TAG_LEN = 16;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const randomBytes = (n: number): Uint8Array => getRandomBytes(n);
export const newKey = () => randomBytes(32);

export function utf8(s: string) {
  return enc.encode(s);
}
export function fromUtf8(b: Uint8Array) {
  return dec.decode(b);
}

/** Envelope: MAGIC | nonce(12) | ciphertext || tag(16). AAD binds ciphertext to its context. */
export function seal(key: Uint8Array, plaintext: Uint8Array, aad: string): Uint8Array {
  if (key.length !== 32) throw new Error('AES-256 key required');
  const nonce = randomBytes(NONCE_LEN);
  // Native (OpenSSL via JSI) AES-256-GCM — orders of magnitude faster than pure JS.
  const c = QuickCrypto.createCipheriv('aes-256-gcm', key, nonce);
  c.setAAD(utf8(aad) as never);
  const body = c.update(plaintext);
  const fin = c.final();
  const tag = c.getAuthTag();
  const out = new Uint8Array(MAGIC.length + NONCE_LEN + body.length + fin.length + TAG_LEN);
  out.set(MAGIC, 0);
  out.set(nonce, MAGIC.length);
  out.set(body, MAGIC.length + NONCE_LEN);
  out.set(fin, MAGIC.length + NONCE_LEN + body.length);
  out.set(tag, out.length - TAG_LEN);
  return out;
}

export function open(key: Uint8Array, envelope: Uint8Array, aad: string): Uint8Array {
  for (let i = 0; i < MAGIC.length; i++) {
    if (envelope[i] !== MAGIC[i]) throw new Error('Not a DocVault envelope');
  }
  const nonce = envelope.subarray(MAGIC.length, MAGIC.length + NONCE_LEN);
  const ct = envelope.subarray(MAGIC.length + NONCE_LEN, envelope.length - TAG_LEN);
  const tag = envelope.subarray(envelope.length - TAG_LEN);
  const d = QuickCrypto.createDecipheriv('aes-256-gcm', key, nonce);
  d.setAAD(utf8(aad) as never);
  d.setAuthTag(tag as never);
  const body = d.update(ct);
  const fin = d.final(); // throws on tampering (GCM tag mismatch)
  const out = new Uint8Array(body.length + fin.length);
  out.set(body, 0);
  out.set(fin, body.length);
  return out;
}

export const sealJson = (key: Uint8Array, value: unknown, aad: string) =>
  seal(key, utf8(JSON.stringify(value)), aad);
export const openJson = <T>(key: Uint8Array, env: Uint8Array, aad: string): T =>
  JSON.parse(fromUtf8(open(key, env, aad))) as T;

// ---- Encoding helpers ----
export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return globalThis.btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const s = globalThis.atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const hashHex = (bytes: Uint8Array) => toHex(sha256(bytes));

export function uuid(): string {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = toHex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- Recovery key ----
// 160 bits, Crockford base32, grouped: XXXX-XXXX-... (8 groups of 4).
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateRecoveryKey(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{4}/g)!.join('-');
}

export function normalizeRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export interface KdfParams {
  alg: 'scrypt';
  salt: string; // b64
  N: number;
  r: number;
  p: number;
}

export function newKdfParams(): KdfParams {
  return { alg: 'scrypt', salt: toB64(randomBytes(16)), N: 2 ** 15, r: 8, p: 1 };
}

export async function deriveKek(secret: string, params: KdfParams): Promise<Uint8Array> {
  return scryptAsync(utf8(secret), fromB64(params.salt), {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: 32,
  });
}

/** Constant-time comparison for PIN verification hashes. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
