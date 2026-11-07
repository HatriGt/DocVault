/**
 * On-device document classification. Uses the filename plus any text the
 * OCR provider returns (see ocr.ts) to suggest category, type and expiry.
 */
import { BUILTIN_CATEGORIES } from './categories';

const RULES: { re: RegExp; type: string }[] = [
  { re: /passport|passeport|reisepass/i, type: 'Passport' },
  { re: /aadhaa?r|uidai/i, type: 'Aadhaar' },
  { re: /\bpan\b|permanent account number|income tax department/i, type: 'PAN Card' },
  { re: /driv(ing|er'?s?)[ _-]?licen[cs]e|\bdl\b/i, type: 'Driving Licence' },
  { re: /residen(ce|t)[ _-]?(permit|card)|\bbrp\b|green card/i, type: 'Residence Permit' },
  { re: /\bvisa\b|e-?visa/i, type: 'Visa' },
  { re: /emirates[ _-]?id|national[ _-]?id|identity card|\bnic\b/i, type: 'National ID' },
  { re: /boarding[ _-]?pass/i, type: 'Boarding Pass' },
  { re: /e-?ticket|itinerary|flight|pnr/i, type: 'Flight Ticket' },
  { re: /hotel|booking|reservation/i, type: 'Hotel Booking' },
  { re: /travel[ _-]?insurance/i, type: 'Travel Insurance' },
  { re: /insurance|policy/i, type: 'Insurance' },
  { re: /statement|bank/i, type: 'Bank Statement' },
  { re: /credit[ _-]?card|debit[ _-]?card/i, type: 'Credit Card' },
  { re: /tax|itr|form[ _-]?16|w-?2|1099/i, type: 'Tax Document' },
  { re: /invest|mutual fund|demat|portfolio/i, type: 'Investment Document' },
  { re: /birth/i, type: 'Birth Certificate' },
  { re: /marriage/i, type: 'Marriage Certificate' },
  { re: /degree|diploma|transcript|certificate|marksheet/i, type: 'Educational Certificate' },
  { re: /medical|prescription|lab report|hospital|vaccin/i, type: 'Medical Document' },
];

export interface Suggestion {
  category: string;
  docType: string | null;
  expiry: string | null;
  number: string | null;
  tags: string[];
}

export function categoryForType(type: string | null): string {
  if (!type) return 'personal';
  return BUILTIN_CATEGORIES.find((c) => c.types.includes(type))?.id ?? 'personal';
}

export function prettifyName(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled document';
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Finds the latest plausible date following an "expiry"-like label. */
export function extractExpiry(text: string): string | null {
  const label = /(expir\w*|valid (until|till|thru)|date of expiry|exp\.?)[^0-9a-z]{0,6}/gi;
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = label.exec(text))) {
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const d = parseDate(tail);
    if (d && (!best || d > best)) best = d;
  }
  return best;
}

export function parseDate(s: string): string | null {
  let m = s.match(/(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})\s*([A-Za-z]{3})[a-z]*\s*(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function suggest(fileName: string, ocrText = ''): Suggestion {
  const hay = `${fileName}\n${ocrText}`;
  const rule = RULES.find((r) => r.re.test(hay));
  const docType = rule?.type ?? null;
  const number =
    ocrText.match(/\b([A-Z]\d{7})\b/)?.[1] ?? // passport-like
    ocrText.match(/\b(\d{4}\s\d{4}\s\d{4})\b/)?.[1] ?? // aadhaar
    ocrText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/)?.[1] ?? // PAN
    null;
  const expiry = extractExpiry(ocrText);
  const tags = [
    ...(docType ? [docType.toLowerCase().replace(/\s+/g, '-')] : []),
    ...(/(^|[^a-z])(uae|emirates|dubai)([^a-z]|$)/i.test(hay) ? ['uae'] : []),
    ...(/(^|[^a-z])india([^a-z]|$)/i.test(hay) ? ['india'] : []),
  ];
  return { category: categoryForType(docType), docType, expiry, number, tags };
}
