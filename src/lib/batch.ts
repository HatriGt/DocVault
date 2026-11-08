/** Multi-select batch operations used by the Library. */
import * as Sharing from 'expo-sharing';
import { PDFDocument, PageSizes } from 'pdf-lib';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import type { DocRecord } from './db';
import { decryptDocument, deleteDocument, normalizeTags, parseTags, restoreDocument, updateDetails } from './documents';
import { toast } from './toast';
import { moveDocument } from './folders';
import { purgeTempPlain, writeTempPlain } from './blobs';
import { resolveType } from './filetype';
import { logActivity } from './activity';

export async function moveMany(docs: DocRecord[], folderId: string | null) {
  for (const d of docs) await moveDocument(d.id, folderId, true);
}

export async function tagMany(docs: DocRecord[], tags: string[]) {
  for (const d of docs) await updateDetails(d.id, { tags: normalizeTags([...parseTags(d), ...tags]) });
}

export async function favoriteMany(docs: DocRecord[], on: boolean) {
  for (const d of docs) await updateDetails(d.id, { favorite: on ? 1 : 0 });
}

export async function confirmDeleteMany(docs: DocRecord[], after: () => void) {
  for (const d of docs) await deleteDocument(d);
  after();
  toast(`${docs.length} moved to Recently Deleted`, {
    icon: 'trash-outline',
    action: {
      label: 'Undo',
      run: async () => {
        for (const d of docs) await restoreDocument(d);
      },
    },
  });
}

/**
 * "Share as one PDF": combines PDFs and images into a single file — e.g. a
 * travel pack (passport + visa + insurance) — and opens the share sheet.
 * Returns the number of documents that couldn't be included.
 */
export async function shareAsOnePdf(docs: DocRecord[], title: string): Promise<number> {
  const out = await PDFDocument.create();
  let skipped = 0;
  try {
    for (const d of docs) {
      const plain = await decryptDocument(d);
      const t = resolveType(plain, `${d.name}.${d.ext}`, d.mime);
      if (t.mime === 'application/pdf') {
        const src = await PDFDocument.load(plain, { ignoreEncryption: true });
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      } else if (t.mime.startsWith('image/')) {
        let bytes = plain;
        let png = t.mime === 'image/png';
        if (t.mime !== 'image/jpeg' && !png) {
          const f = writeTempPlain(`pack-${d.id}.${t.ext}`, plain);
          const saved = await (await ImageManipulator.manipulate(f.uri).renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
          bytes = await new File(saved.uri).bytes();
          new File(saved.uri).delete();
          png = false;
        }
        const img = png ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const [W, H] = img.width > img.height ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
        const page = out.addPage([W, H]);
        const s = Math.min((W - 48) / img.width, (H - 48) / img.height);
        page.drawImage(img, { x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, width: img.width * s, height: img.height * s });
      } else {
        skipped++;
        continue;
      }
      logActivity(d.id, 'shared', 'in a combined PDF');
    }
    if (out.getPageCount() === 0) throw new Error('None of the selected documents are PDFs or images.');
    out.setTitle(title);
    const file = writeTempPlain(`${title.replace(/[\\/:*?"<>|]/g, '_')}.pdf`, await out.save());
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
    return skipped;
  } finally {
    setTimeout(purgeTempPlain, 60_000);
  }
}
