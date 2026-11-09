import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
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
          setError(null);
          setLoading(false);
        })
        .catch((e) => {
          if (!alive || mine !== seq) return;
          setError(e);
          setLoading(false);
        });
    };
    reload();
    const unsubs = (JSON.parse(key)[0] as Topic[]).map((t) => subscribe(t, reload));
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [key, attempt]);
  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);
  return { value, loading, error, retry };
}

export function useDocuments() {
  const { value, loading, error, retry } = useLive<DocRecord[]>(['documents'], listDocs, []);
  return { docs: value, loading, error, retry };
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

export function useFolders() {
  const { value, loading, error, retry } = useLive<Folder[]>(['documents'], listFolders, []);
  return { folders: value, loading, error, retry };
}

export function useActivity(docId: string | undefined) {
  return useLive<Activity[]>(['activity'], () => (docId ? listActivity(docId) : Promise.resolve([])), [], [docId]).value;
}

export function useTrash() {
  const { value, loading, error, retry } = useLive<DocRecord[]>(['documents'], listTrashed, []);
  return { items: value, loading, error, retry };
}
