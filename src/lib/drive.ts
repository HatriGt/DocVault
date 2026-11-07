/**
 * Minimal Google Drive v3 REST client scoped to the hidden appDataFolder.
 * All payloads passed here are already encrypted.
 */
import { getAccessToken } from './google';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const RESUMABLE_THRESHOLD = 4 * 1024 * 1024;
const CHUNK = 2 * 1024 * 1024; // multiple of 256 KiB, as Drive requires

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
  size?: string;
}

export class DriveError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

async function req(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError(0, 'Network unavailable');
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 800 + Math.random() * 300));
    return req(url, init, attempt + 1);
  }
  if (!res.ok && res.status !== 308) {
    const text = await res.text().catch(() => '');
    throw new DriveError(res.status, `Drive ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

const FIELDS = 'id,name,modifiedTime,appProperties,size';

export async function findByName(name: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and trashed = false`);
  const res = await req(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(${FIELDS})`);
  const j = await res.json();
  return j.files?.[0] ?? null;
}

export async function listAll(prefix?: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = prefix ? `&q=${encodeURIComponent(`name contains '${prefix}' and trashed = false`)}` : '';
    const res = await req(
      `${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(${FIELDS})${q}${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    const j = await res.json();
    out.push(...(j.files ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

export async function download(fileId: string): Promise<Uint8Array> {
  const res = await req(`${API}/files/${fileId}?alt=media`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function remove(fileId: string) {
  try {
    await req(`${API}/files/${fileId}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return;
    throw e;
  }
}

function multipartBody(meta: object, bytes: Uint8Array, boundary: string) {
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return body;
}

export interface UploadArgs {
  name: string;
  bytes: Uint8Array;
  appProperties?: Record<string, string>;
  existingId?: string | null;
  /** Persisted resumable session; lets an interrupted upload continue after restart. */
  session?: string | null;
  onSession?: (uri: string | null) => Promise<void> | void;
  onProgress?: (fraction: number) => void;
}

export async function upload(a: UploadArgs): Promise<DriveFile> {
  const meta: Record<string, unknown> = { name: a.name, appProperties: a.appProperties };
  if (!a.existingId) meta.parents = ['appDataFolder'];

  if (a.bytes.length < RESUMABLE_THRESHOLD) {
    const boundary = `dv${Date.now().toString(36)}`;
    const url = a.existingId
      ? `${UPLOAD}/files/${a.existingId}?uploadType=multipart&fields=${FIELDS}`
      : `${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`;
    const res = await req(url, {
      method: a.existingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(meta, a.bytes, boundary) as unknown as BodyInit,
    });
    a.onProgress?.(1);
    return res.json();
  }

  // Resumable upload for large files.
  let session = a.session ?? null;
  let offset = 0;
  if (session) {
    try {
      const probe = await req(session, { method: 'PUT', headers: { 'Content-Range': `bytes */${a.bytes.length}` } });
      if (probe.status !== 308) return probe.json(); // already complete
      const range = probe.headers.get('Range');
      offset = range ? Number(range.split('-')[1]) + 1 : 0;
    } catch {
      session = null; // expired (sessions last ~1 week) — start over
    }
  }
  if (!session) {
    const url = a.existingId
      ? `${UPLOAD}/files/${a.existingId}?uploadType=resumable&fields=${FIELDS}`
      : `${UPLOAD}/files?uploadType=resumable&fields=${FIELDS}`;
    const init = await req(url, {
      method: a.existingId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/octet-stream',
        'X-Upload-Content-Length': String(a.bytes.length),
      },
      body: JSON.stringify(meta),
    });
    session = init.headers.get('Location');
    if (!session) throw new DriveError(0, 'No resumable session returned');
    offset = 0;
  }
  await a.onSession?.(session);

  while (true) {
    const end = Math.min(offset + CHUNK, a.bytes.length);
    const res = await req(session, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${a.bytes.length}` },
      body: a.bytes.slice(offset, end) as unknown as BodyInit,
    });
    a.onProgress?.(end / a.bytes.length);
    if (res.status === 308) {
      const range = res.headers.get('Range');
      offset = range ? Number(range.split('-')[1]) + 1 : end;
      continue;
    }
    await a.onSession?.(null);
    return res.json();
  }
}

// ---- Changes feed (multi-device sync) ----
export async function getStartPageToken(): Promise<string> {
  const res = await req(`${API}/changes/startPageToken?spaces=appDataFolder`);
  return (await res.json()).startPageToken;
}

export interface DriveChange {
  fileId: string;
  removed?: boolean;
  file?: DriveFile & { trashed?: boolean };
}

export async function listChanges(pageToken: string): Promise<{ changes: DriveChange[]; newStartPageToken: string }> {
  const changes: DriveChange[] = [];
  let token: string | undefined = pageToken;
  let newStart = pageToken;
  while (token) {
    const res = await req(
      `${API}/changes?spaces=appDataFolder&pageSize=500&pageToken=${token}&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(${FIELDS},trashed))`,
    );
    const j = await res.json();
    changes.push(...(j.changes ?? []));
    token = j.nextPageToken;
    if (j.newStartPageToken) newStart = j.newStartPageToken;
  }
  return { changes, newStartPageToken: newStart };
}
