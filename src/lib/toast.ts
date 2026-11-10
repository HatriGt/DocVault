/** Tiny global toast bus (rendered by <ToastHost/> in the root layout). */
export interface ToastMsg {
  id: number;
  text: string;
  icon?: string;
  action?: { label: string; run: () => void };
}
type L = (t: ToastMsg | null) => void;
let listener: L | null = null;
let seq = 0;
export const onToast = (l: L) => {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
};
export function toast(text: string, opts: Omit<ToastMsg, 'id' | 'text'> = {}) {
  listener?.({ id: ++seq, text, ...opts });
}
