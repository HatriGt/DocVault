import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, extractExpiry, parseDate, prettifyName } from '../src/lib/classify.ts';
import { makeSamplePdf } from '../src/lib/samplePdf.ts';

test('suggests category and type from filename', () => {
  assert.deepEqual(
    { c: suggest('my_passport_scan.pdf').category, t: suggest('my_passport_scan.pdf').docType },
    { c: 'identity', t: 'Passport' },
  );
  assert.equal(suggest('Emirates ID.pdf').docType, 'National ID');
  assert.equal(suggest('flight-eticket.pdf').category, 'travel');
  assert.equal(suggest('Bank statement March.pdf').category, 'finance');
  assert.equal(suggest('random.pdf').docType, null);
});

test('extracts expiry and numbers from OCR text', () => {
  const s = suggest('scan.jpg', 'REPUBLIC OF INDIA\nPassport No. Z4821937\nDate of Expiry 12/06/2031');
  assert.equal(s.docType, 'Passport');
  assert.equal(s.number, 'Z4821937');
  assert.equal(s.expiry, '2031-06-12');
  assert.equal(extractExpiry('Valid until 15 Mar 2030'), '2030-03-15');
});

test('parseDate validates ranges', () => {
  assert.equal(parseDate('31/12/2030'), '2030-12-31');
  assert.equal(parseDate('2030-01-05'), '2030-01-05');
  assert.equal(parseDate('45/13/2030'), null);
});

test('prettifyName', () => {
  assert.equal(prettifyName('driving_licence-front.jpg'), 'Driving Licence Front');
});

test('sample PDF has a valid header, xref and trailer', () => {
  const pdf = new TextDecoder().decode(makeSamplePdf('Passport', ['Holder: Test (Sample)']));
  assert.ok(pdf.startsWith('%PDF-1.4'));
  assert.ok(pdf.endsWith('%%EOF'));
  const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
  assert.ok(pdf.includes('Holder: Test \\(Sample\\)'));
});

import { normalizeTags } from '../src/lib/tags.ts';
test('normalizeTags cleans, dedupes and lowercases hashtags', () => {
  assert.deepEqual(normalizeTags('#Travel, visa  #UAE #travel ##x!'), ['travel', 'visa', 'uae', 'x']);
  assert.deepEqual(normalizeTags(['  ', '#Ünïcode']), ['ünïcode']);
});
test('suggest returns tags', () => {
  assert.deepEqual(suggest('emirates_id_dubai.pdf').tags, ['national-id', 'uae']);
});
