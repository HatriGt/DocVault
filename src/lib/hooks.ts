import { useEffect, useRef, useState } from 'react';
import { subscribe, Topic } from './events';
import { DocRecord, getDoc, listCustomCategories, listDocs, CustomCategory, listTags, listTrashed } from './db';
import { Account, DEFAULT_PREFS, getAccount, getPrefs, Preferences } from './session';
import { getSyncStatus, SyncStatus } from './sync';
import { BUILTIN_CATEGORIES, Category } from './categories';
import { Folder, listFolders } from './folders';
import { Activity, listActivity } from './activity';

function useLive<T>(topics: Topic[], load: () => Promise<T>, initial: T, deps: unknown[] = []) {
  const [value, setValue] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const key = JSON.stringify([topics, deps]);
  useEffect(() => {
    let alive = true;
    let seq = 0;
    const reload = () => {
      const mine = ++seq;
      loadRef.current()
        .then((v) => {
          if (!alive || mine !== seq) return; // ignore out-of-order results
          setValue(v);
          setLoading(false);
        })
        .catch(() => {
          if (alive && mine === seq) setLoading(false);
        });
    };
    reload();
    const unsubs = (JSON.parse(key)[0] as Topic[]).map((t) => subscribe(t, reload));
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [key]);
  return { value, loading };
}

export function useDocuments() {
  const { value, loading } = useLive<DocRecord[]>(['documents'], listDocs, []);
  return { docs: value, loading };
}

export function useDocument(id: string | undefined) {
  const { value, loading } = useLive<DocRecord | null>(['documents'], () => (id ? getDoc(id) : Promise.resolve(null)), null, [id]);
  return { doc: value, loading };
}

export function useAccount() {
  const { value, loading } = useLive<Account | null>(['session'], getAccount, null);
  return { account: value, loading };
}

export function usePrefs(): Preferences {
  return useLive<Preferences>(['settings'], getPrefs, DEFAULT_PREFS).value;
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState(getSyncStatus());
  useEffect(() => subscribe('sync', () => setS(getSyncStatus())), []);
  return s;
}

export function useCategories(): Category[] {
  const { value } = useLive<CustomCategory[]>(['documents'], listCustomCategories, []);
  return [...BUILTIN_CATEGORIES, ...value.map((c) => ({ ...c, types: [], custom: true }))];
}

export function useTags() {
  return useLive<{ tag: string; count: number }[]>(['documents'], listTags, []).value;
}

export function useFolders(): Folder[] {
  return useLive<Folder[]>(['documents'], listFolders, []).value;
}

export function useActivity(docId: string | undefined) {
  return useLive<Activity[]>(['activity'], () => (docId ? listActivity(docId) : Promise.resolve([])), [], [docId]).value;
}

export function useTrash(): DocRecord[] {
  return useLive<DocRecord[]>(['documents'], listTrashed, []).value;
}
