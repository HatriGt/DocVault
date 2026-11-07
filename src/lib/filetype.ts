/** Detects a file's real type from its leading bytes (shared files often lack extensions). */
export interface Sniffed {
  mime: string;
  ext: string;
}

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

export const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  rtf: 'application/rtf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  zip: 'application/zip',
};

export const extOf = (name: string) => name.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ?? '';
export const mimeForExt = (ext: string) => EXT_MIME[ext.toLowerCase()];
export const extForMime = (mime: string) => Object.entries(EXT_MIME).find(([, m]) => m === mime)?.[0];

export function sniffType(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (starts(b, [0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf' }; // %PDF
  if (starts(b, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav' };
  if (ascii(b, 0, 3) === 'GIF') return { mime: 'image/gif', ext: 'gif' };
  if (ascii(b, 0, 2) === 'BM') return { mime: 'image/bmp', ext: 'bmp' };
  if (ascii(b, 0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (starts(b, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', ext: 'webm' };
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (/hei[cx]|mif1|msf1|heim|heis/.test(brand)) return { mime: 'image/heic', ext: 'heic' };
    if (/M4A |M4B /.test(brand)) return { mime: 'audio/mp4', ext: 'm4a' };
    if (/qt {2}/.test(brand)) return { mime: 'video/quicktime', ext: 'mov' };
    return { mime: 'video/mp4', ext: 'mp4' };
  }
  if (starts(b, [0x50, 0x4b, 0x03, 0x04])) return { mime: 'application/zip', ext: 'zip' }; // also docx/xlsx/pptx
  if (starts(b, [0xd0, 0xcf, 0x11, 0xe0])) return { mime: 'application/x-ole-storage', ext: 'doc' }; // legacy .doc/.xls/.ppt
  if (ascii(b, 0, 5) === '{\\rtf') return { mime: 'application/rtf', ext: 'rtf' };
  return null;
}

/**
 * Resolves the best type using bytes first, then name/declared MIME for
 * container formats (Office files are ZIPs; legacy Office files are OLE).
 */
export function resolveType(bytes: Uint8Array, name: string, declaredMime?: string): Sniffed {
  const s = sniffType(bytes);
  const ext = extOf(name);
  const fromName = ext && mimeForExt(ext) ? { mime: mimeForExt(ext)!, ext } : null;
  const declared = declaredMime && declaredMime !== 'application/octet-stream' ? { mime: declaredMime, ext: extForMime(declaredMime) ?? ext ?? 'bin' } : null;
  if (s && s.mime !== 'application/zip' && s.mime !== 'application/x-ole-storage') return s;
  if (s?.mime === 'application/zip' && (fromName || declared)) {
    const c = fromName ?? declared!;
    if (/officedocument|opendocument|zip/.test(c.mime)) return c;
  }
  if (s?.mime === 'application/x-ole-storage') return fromName ?? declared ?? { mime: 'application/msword', ext: 'doc' };
  if (s) return s;
  if (fromName) return fromName;
  if (declared) return declared;
  if (looksLikeText(bytes)) return { mime: 'text/plain', ext: 'txt' };
  return { mime: 'application/octet-stream', ext: ext || 'bin' };
}

function looksLikeText(b: Uint8Array) {
  const n = Math.min(b.length, 4096);
  let bad = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) return false;
    if (c < 9 || (c > 13 && c < 32)) bad++;
  }
  return n > 0 && bad / n < 0.02;
}

export type ViewKind = 'pdf' | 'image' | 'video' | 'audio' | 'word' | 'sheet' | 'text' | 'other';

export function viewKind(mime: string, ext: string): ViewKind {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/') && mime !== 'image/svg+xml') return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (ext === 'docx' || mime.includes('wordprocessingml')) return 'word';
  if (['xlsx', 'xls', 'ods', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime === 'text/csv' || mime === 'application/vnd.ms-excel') return 'sheet';
  if (mime.startsWith('text/') || ['json', 'xml', 'md', 'txt', 'log', 'svg'].includes(ext) || mime === 'application/json') return 'text';
  return 'other';
}
