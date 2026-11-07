type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export type Topic = 'documents' | 'sync' | 'settings' | 'session';

export function emit(topic: Topic) {
  listeners.get(topic)?.forEach((l) => l());
}

export function subscribe(topic: Topic, l: Listener) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(l);
  return () => {
    listeners.get(topic)!.delete(l);
  };
}
