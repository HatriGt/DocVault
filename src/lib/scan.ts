/**
 * Smart scanning: ML Kit Document Scanner (Android) / VisionKit (iOS) with
 * automatic edge detection, perspective correction and filters.
 * Pages are kept as files in cache/scans so the user can review them
 * (rotate, reorder, delete, add more) before anything is saved.
 */
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument, PageSizes } from 'pdf-lib';

export interface ScanResult {
  uri: string;
  name: string;
  mime: string;
  pages: number;
}

export interface ScanPage {
  uri: string;
  width: number;
  height: number;
}

const stamp = () => new Date().toISOString().slice(0, 10);

function scansDir() {
  const dir = new Directory(Paths.cache, 'scans');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Opens the system scanner. Returns the captured pages, or null if cancelled. */
export async function scanPages(max = 20): Promise<ScanPage[] | null> {
  const res = await DocumentScanner.scanDocument({ maxNumDocuments: max, croppedImageQuality: 92, responseType: ResponseType.ImageFilePath });
  if (res.status === ScanDocumentResponseStatus.Cancel || !res.scannedImages?.length) return null;
  const out: ScanPage[] = [];
  for (const p of res.scannedImages) {
    const src = new File(p.startsWith('file://') ? p : `file://${p}`);
    const dest = new File(scansDir(), `page-${Date.now()}-${out.length}.jpg`);
    src.moveSync(dest); // own the file so it's always cleaned up
    const ref = await ImageManipulator.manipulate(dest.uri).renderAsync();
    out.push({ uri: dest.uri, width: ref.width, height: ref.height });
  }
  return out;
}

/** Rotates one page by ±90° and returns the new page (old file deleted). */
export async function rotatePage(page: ScanPage, deg: 90 | -90): Promise<ScanPage> {
  const ref = await ImageManipulator.manipulate(page.uri).rotate(deg).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  const dest = new File(scansDir(), `page-${Date.now()}.jpg`);
  new File(saved.uri).moveSync(dest);
  discardScan(page.uri);
  return { uri: dest.uri, width: saved.width, height: saved.height };
}

/** Builds the final file: one PDF for several pages (or on request), or a single photo. */
export async function buildScan(pages: ScanPage[], asPdf: boolean): Promise<ScanResult> {
  if (!pages.length) throw new Error('Add at least one page.');
  if (!asPdf && pages.length === 1) return { uri: pages[0].uri, name: `Scan ${stamp()}.jpg`, mime: 'image/jpeg', pages: 1 };
  const pdf = await PDFDocument.create();
  try {
    for (const p of pages) {
      const img = await pdf.embedJpg(await new File(p.uri).bytes());
      const [W, H] = img.width > img.height ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
      const page = pdf.addPage([W, H]);
      const s = Math.min(W / img.width, H / img.height);
      page.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
    }
  } finally {
    pages.forEach((p) => discardScan(p.uri)); // never leave plaintext page images in the cache
  }
  const out = new File(scansDir(), `scan-${Date.now()}.pdf`);
  out.create();
  out.write(await pdf.save());
  return { uri: out.uri, name: `Scan ${stamp()}.pdf`, mime: 'application/pdf', pages: pages.length };
}

/** Deletes a scanner output file. */
export function discardScan(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

/** Startup janitor: removes any leftover scan outputs. */
export function purgeScanCache() {
  try {
    const d = new Directory(Paths.cache, 'scans');
    if (d.exists) d.delete();
  } catch {}
}
