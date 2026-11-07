/** Detects a file's real type from its leading bytes (shared files often lack extensions). */
export interface Sniffed {
  mime: string;
  ext: string;
}

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

export function sniffType(b: Uint8Array): Sniffed | null {
  if (b.length < 12) return null;
  if (starts(b, [0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf' }; // %PDF
  if (starts(b, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii(b, 0, 3) === 'GIF') return { mime: 'image/gif', ext: 'gif' };
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (/hei[cx]|mif1|msf1|heim|heis/.test(brand)) return { mime: 'image/heic', ext: 'heic' };
  }
  return null;
}
