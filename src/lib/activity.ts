/**
 * Private, on-device activity history per document (added, opened, shared…).
 * Never synced or uploaded — it's a record for the user only.
 */
import { getDb } from './db';
import { emit } from './events';

export type ActivityKind = 'added' | 'opened' | 'shared' | 'edited' | 'moved' | 'exported' | 'synced';

export interface Activity {
  id: number;
  doc_id: string;
  kind: ActivityKind;
  detail: string | null;
  at: number;
}

export async function logActivity(docId: string, kind: ActivityKind, detail?: string) {
  try {
    const db = await getDb();
    // Collapse repeated "opened" events within 5 minutes.
    if (kind === 'opened') {
      const last = await db.getFirstAsync<Activity>('SELECT * FROM activity WHERE doc_id = ? ORDER BY at DESC LIMIT 1', docId);
      if (last?.kind === 'opened' && Date.now() - last.at < 5 * 60_000) return;
    }
    await db.runAsync('INSERT INTO activity (doc_id, kind, detail, at) VALUES (?, ?, ?, ?)', docId, kind, detail ?? null, Date.now());
    await db.runAsync(
      'DELETE FROM activity WHERE doc_id = ? AND id NOT IN (SELECT id FROM activity WHERE doc_id = ? ORDER BY at DESC LIMIT 100)',
      docId,
      docId,
    );
    emit('activity');
  } catch {
    // history is best-effort
  }
}

export async function listActivity(docId: string): Promise<Activity[]> {
  const db = await getDb();
  return db.getAllAsync<Activity>('SELECT * FROM activity WHERE doc_id = ? ORDER BY at DESC LIMIT 30', docId);
}
