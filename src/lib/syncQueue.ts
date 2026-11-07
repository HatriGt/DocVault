/** Debounced sync trigger, decoupled from sync.ts to avoid import cycles. */
type Runner = () => Promise<unknown>;
let runner: Runner | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function registerSyncRunner(r: Runner) {
  runner = r;
}

export function requestSync(delayMs = 800) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runner?.().catch(() => {});
  }, delayMs);
}
