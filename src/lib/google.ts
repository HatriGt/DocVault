/**
 * Google OAuth token storage + refresh. Authentication only — Google tokens
 * grant access to ciphertext in Drive, never to vault keys.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { emit } from './events';

const TOKENS_KEY = 'dv.google.tokens.v1';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  // Hidden, app-private Drive folder. The app cannot see the user's other files.
  'https://www.googleapis.com/auth/drive.appdata',
];

export const googleClientIds = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const isGoogleConfigured = () =>
  Boolean(Platform.OS === 'ios' ? googleClientIds.iosClientId : googleClientIds.androidClientId);

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  clientId: string;
}

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
}

let memTokens: GoogleTokens | null = null;

export async function saveTokens(t: GoogleTokens) {
  memTokens = t;
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(t), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY, // background sync
  });
  emit('session');
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  if (memTokens) return memTokens;
  const raw = await SecureStore.getItemAsync(TOKENS_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  memTokens = raw ? JSON.parse(raw) : null;
  return memTokens;
}

export async function clearTokens() {
  const t = await loadTokens();
  memTokens = null;
  await SecureStore.deleteItemAsync(TOKENS_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (t) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refreshToken ?? t.accessToken)}`, {
      method: 'POST',
    }).catch(() => {});
  }
  emit('session');
}

export class AuthRequiredError extends Error {
  constructor() {
    super('Google sign-in required');
  }
}

let refreshing: Promise<string> | null = null;

/** Returns a valid access token, refreshing if within 60s of expiry. */
export async function getAccessToken(): Promise<string> {
  const t = await loadTokens();
  if (!t) throw new AuthRequiredError();
  if (t.expiresAt - Date.now() > 60_000) return t.accessToken;
  if (!t.refreshToken) throw new AuthRequiredError();
  if (!refreshing) {
    refreshing = (async () => {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${encodeURIComponent(t.clientId)}&grant_type=refresh_token&refresh_token=${encodeURIComponent(t.refreshToken!)}`,
      });
      if (!res.ok) {
        if (res.status === 400 || res.status === 401) throw new AuthRequiredError();
        throw new Error(`Token refresh failed (${res.status})`);
      }
      const j = await res.json();
      await saveTokens({ ...t, accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 });
      return j.access_token as string;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not load Google profile');
  const j = await res.json();
  return { email: j.email, name: j.name ?? j.email, picture: j.picture };
}
