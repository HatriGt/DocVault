import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { resolveType, viewKind } from '../src/lib/filetype.ts';
import { readSheets, textToHtml } from '../src/lib/officeRender.ts';

const enc = new TextEncoder();
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(20).fill(0)]);

test('resolveType: Office ZIP containers resolved by name / declared mime', () => {
  assert.equal(resolveType(zip, 'Offer Letter.docx').ext, 'docx');
  assert.equal(resolveType(zip, 'budget', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').ext, 'xlsx');
  assert.equal(resolveType(zip, 'archive.zip').ext, 'zip');
  assert.equal(resolveType(enc.encode('hello world, plain notes\n'.repeat(4)), 'notes').mime, 'text/plain');
  assert.equal(resolveType(enc.encode('%PDF-1.7 ....'), 'wrong.jpg').ext, 'pdf'); // bytes beat the name
  assert.equal(resolveType(new Uint8Array([0, 1, 2, 3, 0, 0, 9, 9, 9, 9, 9, 9, 0]), 'blob').ext, 'bin');
});

test('viewKind routes formats to the right renderer', () => {
  assert.equal(viewKind('application/pdf', 'pdf'), 'pdf');
  assert.equal(viewKind('image/heic', 'heic'), 'image');
  assert.equal(viewKind('video/mp4', 'mp4'), 'video');
  assert.equal(viewKind('audio/mpeg', 'mp3'), 'audio');
  assert.equal(viewKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'), 'word');
  assert.equal(viewKind('text/csv', 'csv'), 'sheet');
  assert.equal(viewKind('application/json', 'json'), 'text');
  assert.equal(viewKind('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'), 'other');
});

test('spreadsheets render to escaped HTML tables, one per sheet', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Name', 'Amount'], ['<b>Rent</b>', 1200]]), 'Budget');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Notes');
  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const book = readSheets(bytes, 'xlsx');
  assert.deepEqual(book.names, ['Budget', 'Notes']);
  const html = book.html(0, false);
  assert.ok(html.includes('1200'));
  assert.ok(html.includes('&lt;b&gt;Rent&lt;/b&gt;'));
  assert.ok(html.includes("default-src 'none'")); // CSP: no scripts / network
  assert.ok(readSheets(enc.encode('a,b\n1,2'), 'csv').html(0, true).includes('<td'));
});

test('text renders escaped and pretty-prints JSON', () => {
  assert.ok(textToHtml(enc.encode('<script>alert(1)</script>'), false).includes('&lt;script&gt;'));
  assert.ok(textToHtml(enc.encode('{"a":1}'), false).includes('&quot;a&quot;: 1'));
});
