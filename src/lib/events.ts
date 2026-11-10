/**
 * Topic-scoped event bus with coalescing: many emits in the same tick (e.g. a
 * batch update of 100 documents) trigger a single notification per topic.
 */
type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const pending = new Set<string>();
let scheduled = false;

export type Topic = 'documents' | 'sync' | 'settings' | 'session' | 'activity';

function flush() {
  scheduled = false;
  const topics = [...pending];
  pending.clear();
  for (const t of topics) listeners.get(t)?.forEach((l) => l());
}

export function emit(topic: Topic) {
  pending.add(topic);
  if (!scheduled) {
    scheduled = true;
    setTimeout(flush, 0);
  }
}

export function subscribe(topic: Topic, l: Listener) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic)!.add(l);
  return () => {
    listeners.get(topic)!.delete(l);
  };
}
