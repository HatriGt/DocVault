/**
 * Edit & convert tools. Everything runs on-device:
 *  - images: expo-image-manipulator (crop, rotate, flip, resize, JPG/PNG/WEBP, compression)
 *  - PDFs:   pdf-lib (images → PDF, merge, split, extract, rotate pages)
 * Results are encrypted like any other document, saved as a new document or
 * replacing the original.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { degrees, PDFDocument, PageSizes } from 'pdf-lib';
import { createDocument, decryptDocument, parseFields, parseTags, replaceContent } from './documents';
import { purgeTempPlain, writeTempPlain } from './blobs';
import { sniffType } from './filetype';
import type { DocRecord } from './db';

export type SaveMode = 'new' | 'replace';
export type ImageFormat = 'jpeg' | 'png' | 'webp';

const MIME: Record<ImageFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT: Record<ImageFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const baseName = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, '');

async function output(src: DocRecord, plain: Uint8Array, mime: string, ext: string, mode: SaveMode, name: string) {
  if (mode === 'replace') {
    await replaceContent(src, plain, mime, ext);
    return src.id;
  }
  const rec = await createDocument(plain, { name: `${name}.${ext}`, mime }, {
    name,
    category: src.category,
    docType: src.doc_type,
    expiry: src.expiry,
    fields: parseFields(src),
    tags: parseTags(src),
    folderId: src.folder_id,
  });
  return rec.id;
}

/** Decrypts an image into a temp file the manipulator can read. */
async function tempImage(doc: DocRecord) {
  const plain = await decryptDocument(doc);
  const t = sniffType(plain);
  return writeTempPlain(`edit-${doc.id}.${t?.ext ?? 'jpg'}`, plain);
}

export interface Working {
  uri: string;
  width: number;
  height: number;
}

/** Decrypts an image into an editable working copy. */
export async function openWorking(doc: DocRecord): Promise<Working> {
  const f = await tempImage(doc);
  const ref = await ImageManipulator.manipulate(f.uri).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.PNG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Applies an instant transform (rotate/flip) to the working copy. */
export async function transformWorking(w: Working, op: 'left' | 'right' | 'flipH' | 'flipV'): Promise<Working> {
  let ctx = ImageManipulator.manipulate(w.uri);
  ctx = op === 'left' ? ctx.rotate(-90) : op === 'right' ? ctx.rotate(90) : ctx.flip(op === 'flipH' ? 'horizontal' : 'vertical');
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.PNG });
  new File(w.uri).delete();
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export interface ImageExport {
  crop?: { originX: number; originY: number; width: number; height: number }; // source pixels
  maxSide?: number;
  format: ImageFormat;
  quality: number; // 0..1
}

export async function saveWorking(doc: DocRecord, w: Working, e: ImageExport, mode: SaveMode, name?: string) {
  try {
    let ctx = ImageManipulator.manipulate(w.uri);
    if (e.crop) ctx = ctx.crop(e.crop);
    let ref = await ctx.renderAsync();
    if (e.maxSide && Math.max(ref.width, ref.height) > e.maxSide) {
      ref = await ImageManipulator.manipulate(ref).resize(ref.width >= ref.height ? { width: e.maxSide } : { height: e.maxSide }).renderAsync();
    }
    const saved = await ref.saveAsync({ format: e.format as SaveFormat, compress: e.format === 'png' ? 1 : e.quality });
    const bytes = await new File(saved.uri).bytes();
    new File(saved.uri).delete();
    return await output(doc, bytes, MIME[e.format], EXT[e.format], mode, name ?? baseName(doc.name));
  } finally {
    discardWorking(w);
  }
}

export function discardWorking(w: Working | null) {
  try {
    if (w && new File(w.uri).exists) new File(w.uri).delete();
  } catch {}
  purgeTempPlain();
}

/** Converts images to JPEG bytes pdf-lib can embed (it supports JPG/PNG only). */
async function embeddable(doc: DocRecord): Promise<{ bytes: Uint8Array; png: boolean }> {
  const plain = await decryptDocument(doc);
  const t = sniffType(plain);
  if (t?.mime === 'image/jpeg') return { bytes: plain, png: false };
  if (t?.mime === 'image/png') return { bytes: plain, png: true };
  const f = writeTempPlain(`conv-${doc.id}.${t?.ext ?? 'img'}`, plain);
  const ref = await ImageManipulator.manipulate(f.uri).renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  const bytes = await new File(saved.uri).bytes();
  new File(saved.uri).delete();
  return { bytes, png: false };
}

export async function imagesToPdf(docs: DocRecord[], opts: { page: 'fit' | 'a4'; margin: number }, name: string) {
  try {
    const pdf = await PDFDocument.create();
    for (const d of docs) {
      const { bytes, png } = await embeddable(d);
      const img = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      if (opts.page === 'fit') {
        const p = pdf.addPage([img.width + opts.margin * 2, img.height + opts.margin * 2]);
        p.drawImage(img, { x: opts.margin, y: opts.margin, width: img.width, height: img.height });
      } else {
        const [W, H] = img.width > img.height ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
        const p = pdf.addPage([W, H]);
        const s = Math.min((W - opts.margin * 2) / img.width, (H - opts.margin * 2) / img.height);
        p.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
      }
    }
    pdf.setTitle(name);
    pdf.setProducer('DocVault');
    return await output(docs[0], await pdf.save(), 'application/pdf', 'pdf', 'new', name);
  } finally {
    purgeTempPlain();
  }
}

async function loadPdf(doc: DocRecord) {
  return PDFDocument.load(await decryptDocument(doc), { ignoreEncryption: true });
}

export async function pdfPageCount(doc: DocRecord) {
  return (await loadPdf(doc)).getPageCount();
}

export async function mergePdfs(docs: DocRecord[], name: string) {
  const out = await PDFDocument.create();
  for (const d of docs) {
    const src = await loadPdf(d);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return output(docs[0], await out.save(), 'application/pdf', 'pdf', 'new', name);
}

/** Extracts the given 0-based pages into one new PDF. */
export async function extractPages(doc: DocRecord, pages: number[], name: string) {
  const src = await loadPdf(doc);
  const out = await PDFDocument.create();
  (await out.copyPages(src, pages)).forEach((p) => out.addPage(p));
  return output(doc, await out.save(), 'application/pdf', 'pdf', 'new', name);
}

/** Splits every page into its own PDF document. Returns the new ids. */
export async function splitPdf(doc: DocRecord) {
  const src = await loadPdf(doc);
  const ids: string[] = [];
  for (const i of src.getPageIndices()) {
    const out = await PDFDocument.create();
    const [p] = await out.copyPages(src, [i]);
    out.addPage(p);
    ids.push(await output(doc, await out.save(), 'application/pdf', 'pdf', 'new', `${baseName(doc.name)} – page ${i + 1}`));
  }
  return ids;
}

export async function rotatePdf(doc: DocRecord, by: 90 | 180 | 270, mode: SaveMode) {
  const pdf = await loadPdf(doc);
  pdf.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + by) % 360)));
  return output(doc, await pdf.save(), 'application/pdf', 'pdf', mode, mode === 'new' ? `${baseName(doc.name)} (rotated)` : baseName(doc.name));
}

export { parsePageRanges } from './pageRanges';
