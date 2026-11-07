import type { AuthSessionResult } from 'expo-auth-session';
import { fetchProfile, GoogleProfile, saveTokens } from './google';

/** Persists tokens from a successful auth-session result and loads the profile. */
export async function completeGoogleSignIn(res: AuthSessionResult, clientId: string): Promise<GoogleProfile | null> {
  if (res.type === 'error') throw new Error(res.error?.message ?? 'Google sign-in failed');
  if (res.type !== 'success' || !res.authentication) return null; // cancelled / dismissed
  const a = res.authentication;
  await saveTokens({
    accessToken: a.accessToken,
    refreshToken: a.refreshToken ?? undefined,
    expiresAt: Date.now() + (a.expiresIn ?? 3600) * 1000,
    clientId,
  });
  return fetchProfile(a.accessToken);
}
