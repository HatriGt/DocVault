import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seal,
  open,
  newKey,
  sealJson,
  openJson,
  generateRecoveryKey,
  normalizeRecoveryKey,
  deriveKek,
  newKdfParams,
  toB64,
  fromB64,
  uuid,
} from '../src/lib/crypto.ts';

test('AES-256-GCM round-trips and produces a fresh nonce each time', () => {
  const key = newKey();
  const msg = new TextEncoder().encode('passport scan bytes');
  const a = seal(key, msg, 'doc:1');
  const b = seal(key, msg, 'doc:1');
  assert.notDeepEqual(a, b);
  assert.deepEqual(open(key, a, 'doc:1'), msg);
});

test('tampering, wrong key and wrong AAD are all rejected', () => {
  const key = newKey();
  const env = seal(key, new Uint8Array([1, 2, 3]), 'doc:1');
  const tampered = env.slice();
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => open(key, tampered, 'doc:1'));
  assert.throws(() => open(newKey(), env, 'doc:1'));
  assert.throws(() => open(key, env, 'doc:2')); // ciphertext bound to its document id
});

test('JSON sealing', () => {
  const key = newKey();
  const v = { name: 'Passport', n: 1 };
  assert.deepEqual(openJson(key, sealJson(key, v, 'meta:x'), 'meta:x'), v);
});

test('recovery key format and normalisation', () => {
  const k = generateRecoveryKey();
  assert.match(k, /^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(normalizeRecoveryKey(k.toLowerCase().replace(/-/g, ' ')), k.replace(/-/g, ''));
  assert.equal(normalizeRecoveryKey('o1-IL'), '0111');
});

test('KEK derivation is deterministic per salt and wraps the VMK', async () => {
  const params = { ...newKdfParams(), N: 2 ** 10 }; // fast for tests
  const k = generateRecoveryKey();
  const kek1 = await deriveKek(normalizeRecoveryKey(k), params);
  const kek2 = await deriveKek(normalizeRecoveryKey(k.toLowerCase()), params);
  assert.deepEqual(kek1, kek2);
  const vmk = newKey();
  const wrapped = seal(kek1, vmk, 'vmk');
  assert.deepEqual(open(kek2, wrapped, 'vmk'), vmk);
  const wrong = await deriveKek(normalizeRecoveryKey(generateRecoveryKey()), params);
  assert.throws(() => open(wrong, wrapped, 'vmk'));
});

test('base64 and uuid helpers', () => {
  const b = newKey();
  assert.deepEqual(fromB64(toB64(b)), b);
  assert.match(uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

import { gcm } from '@noble/ciphers/aes.js';
test('native GCM envelopes are byte-compatible with the previous pure-JS format', () => {
  const key = newKey();
  const msg = new TextEncoder().encode('legacy document');
  // Legacy envelope written by @noble/ciphers: MAGIC | nonce | ct||tag
  const nonce = new Uint8Array(12).fill(7);
  const ct = gcm(key, nonce, new TextEncoder().encode('doc:1')).encrypt(msg);
  const legacy = new Uint8Array(4 + 12 + ct.length);
  legacy.set([0x44, 0x56, 0x4b, 0x31]);
  legacy.set(nonce, 4);
  legacy.set(ct, 16);
  assert.deepEqual(open(key, legacy, 'doc:1'), msg);
  // And new envelopes decrypt with the legacy implementation.
  const env = seal(key, msg, 'doc:1');
  assert.deepEqual(gcm(key, env.subarray(4, 16), new TextEncoder().encode('doc:1')).decrypt(env.subarray(16)), msg);
});

test('large payloads round-trip', () => {
  const key = newKey();
  const big = new Uint8Array(5 * 1024 * 1024).map((_, i) => i & 255);
  assert.deepEqual(open(key, seal(key, big, 'doc:big'), 'doc:big'), big);
});
