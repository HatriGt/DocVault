/**
 * The one place screens give the user feedback, so it reads and behaves the same everywhere.
 *
 * - notify()      success / info → a toast that never blocks.
 * - notifyError() failures → a dialog with a plain-language reason and, when given, "Try again".
 * - inform()      something the user must read (a limit, a missing permission) → a dialog.
 * - confirm()     destructive or irreversible choices → a dialog that resolves to true/false.
 * - choose()      a decision between a few named options → resolves to the picked value or null.
 *
 * Screens never call Alert.alert directly.
 */
import { Alert, Linking } from 'react-native';
import { toast, type ToastMsg } from './toast';

export function notify(text: string, opts: Omit<ToastMsg, 'id' | 'text'> = {}) {
  toast(text, { icon: 'checkmark-circle', ...opts });
}

const TECHNICAL = /(TypeError|ReferenceError|undefined|null\b|Exception|\bat \w+ \(|[{}<>]|0x[0-9a-f]+|E_[A-Z_]+|ERR_)/i;

/**
 * Turns any thrown value into a sentence a person can act on, or null when the user cancelled
 * (nothing to report). Messages from our own code are already written for people and pass through.
 */
export function friendlyError(e: unknown): string | null {
  const raw = (e instanceof Error ? e.message : typeof e === 'string' ? e : '').trim();
  if (/cancel(l)?ed|user dismissed|aborted by user/i.test(raw)) return null;
  if (/network|failed to fetch|fetch failed|timed? ?out|ENOTFOUND|ECONNRE|offline|unable to resolve host/i.test(raw))
    return 'Couldn’t reach the internet. Check your connection and try again.';
  if (/ENOSPC|no space left|disk full|storage full/i.test(raw)) return 'Your phone is out of storage. Free up some space and try again.';
  if (/permission|not authori[sz]ed|denied/i.test(raw)) return 'DocVault doesn’t have permission to do that. You can allow it in your phone’s Settings.';
  if (raw && raw.length <= 200 && !TECHNICAL.test(raw)) return raw.endsWith('.') ? raw : `${raw}.`;
  return 'Something unexpected went wrong. Please try again.';
}

export function notifyError(e: unknown, title: string, opts: { retry?: () => unknown } = {}) {
  const message = friendlyError(e);
  if (message === null) return;
  if (__DEV__) console.warn(`[${title}]`, e);
  Alert.alert(title, message, opts.retry ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Try again', onPress: () => void opts.retry?.() }] : [{ text: 'OK' }]);
}

export function inform(title: string, message: string, action?: { label: string; run: () => unknown }) {
  Alert.alert(title, message, action ? [{ text: 'Not now', style: 'cancel' }, { text: action.label, onPress: () => void action.run() }] : [{ text: 'OK' }]);
}

/** inform() preset for a permission the user turned off. */
export const informPermission = (title: string, message: string) => inform(title, message, { label: 'Open Settings', run: () => Linking.openSettings() });

export function confirm(o: { title: string; message: string; confirmLabel: string; destructive?: boolean; cancelLabel?: string }): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      o.title,
      o.message,
      [
        { text: o.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: o.confirmLabel, style: o.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function choose<V extends string>(title: string, message: string, options: { label: string; value: V }[]): Promise<V | null> {
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [{ text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) }, ...options.map((o) => ({ text: o.label, onPress: () => resolve(o.value) }))],
      { cancelable: true, onDismiss: () => resolve(null) },
    ),
  );
}
