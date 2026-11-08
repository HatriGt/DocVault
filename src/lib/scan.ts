/**
 * Smart scanning: ML Kit Document Scanner (Android) / VisionKit (iOS) with
 * automatic edge detection, perspective correction and filters. Multi-page
 * scans are combined into one PDF on-device.
 */
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin';
import { Directory, File, Paths } from 'expo-file-system';
import { PDFDocument, PageSizes } from 'pdf-lib';

export interface ScanResult {
  uri: string;
  name: string;
  mime: string;
  pages: number;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function scanWithDetection(): Promise<ScanResult | null> {
  const res = await DocumentScanner.scanDocument({ maxNumDocuments: 20, croppedImageQuality: 92, responseType: ResponseType.ImageFilePath });
  if (res.status === ScanDocumentResponseStatus.Cancel || !res.scannedImages?.length) return null;
  const paths = res.scannedImages.map((p) => (p.startsWith('file://') ? p : `file://${p}`));
  if (paths.length === 1) {
    // Move into our own cache folder so it's always cleaned up after import (and at startup).
    const dir = new Directory(Paths.cache, 'scans');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const f = new File(paths[0]);
    const dest = new File(dir, `scan-${Date.now()}.jpg`);
    f.moveSync(dest);
    return { uri: dest.uri, name: `Scan ${stamp()}.jpg`, mime: 'image/jpeg', pages: 1 };
  }

  const pdf = await PDFDocument.create();
  try {
    for (const p of paths) {
      const img = await pdf.embedJpg(await new File(p).bytes());
      const [W, H] = img.width > img.height ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
      const page = pdf.addPage([W, H]);
      const s = Math.min(W / img.width, H / img.height);
      page.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
    }
  } finally {
    paths.forEach(discardScan); // never leave plaintext page images in the cache
  }
  const dir = new Directory(Paths.cache, 'scans');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const out = new File(dir, `scan-${Date.now()}.pdf`);
  out.create();
  out.write(await pdf.save());
  return { uri: out.uri, name: `Scan ${stamp()}.pdf`, mime: 'application/pdf', pages: paths.length };
}

/** Deletes a scanner output file (call after the scan has been imported). */
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
