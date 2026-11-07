import { emit } from './events';
import { kvGet, kvSet } from './db';
import type { GoogleProfile } from './google';

export type AccountMode = 'google' | 'local';

export interface Account {
  mode: AccountMode;
  profile?: GoogleProfile;
  displayName: string;
}

export interface Preferences {
  offlineDefault: 'keep' | 'cloud';
  autoSync: boolean;
  wifiOnly: boolean;
  biometricLock: boolean;
  pinLock: boolean;
  lockAfterSeconds: number;
  expiryReminders: boolean;
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_PREFS: Preferences = {
  offlineDefault: 'keep',
  autoSync: true,
  wifiOnly: false,
  biometricLock: false,
  pinLock: false,
  lockAfterSeconds: 30,
  expiryReminders: true,
  theme: 'system',
};

export const getAccount = () => kvGet<Account | null>('account', null);
export async function setAccount(a: Account | null) {
  await kvSet('account', a);
  emit('session');
}

export async function getPrefs(): Promise<Preferences> {
  return { ...DEFAULT_PREFS, ...(await kvGet<Partial<Preferences>>('prefs', {})) };
}
export async function setPrefs(patch: Partial<Preferences>) {
  await kvSet('prefs', { ...(await getPrefs()), ...patch });
  emit('settings');
}
