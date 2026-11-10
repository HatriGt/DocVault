import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emit, subscribe } from '../src/lib/events.ts';

test('emits in the same tick are coalesced into one notification per topic', async () => {
  let docs = 0;
  let activity = 0;
  const a = subscribe('documents', () => docs++);
  const b = subscribe('activity', () => activity++);
  for (let i = 0; i < 200; i++) emit('documents'); // e.g. a batch tag of 200 documents
  emit('activity');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(docs, 1);
  assert.equal(activity, 1);
  emit('documents');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(docs, 2);
  a();
  b();
});
