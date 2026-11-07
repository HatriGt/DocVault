/**
 * Google sign-in completion that doesn't depend on the browser's close event.
 *
 * On Android, when the Custom Tab closes, expo-auth-session may see the app
 * return to the foreground before the redirect URL and resolve as "dismiss".
 * The redirect still reaches the app as a deep link (handled by the
 * `oauthredirect` route), so we complete the PKCE code exchange from whichever
 * arrives first — promptAsync's result or the deep link — exactly once.
 */
import { AuthRequest, AuthSessionResult, exchangeCodeAsync } from 'expo-auth-session';
import { discovery } from 'expo-auth-session/providers/google';
import { fetchProfile, GoogleProfile, saveTokens } from './google';

interface Pending {
  state: string;
  codeVerifier?: string;
  redirectUri: string;
  clientId: string;
  done: boolean;
}

type Listener = (r: { profile?: GoogleProfile; error?: Error }) => void;

let pending: Pending | null = null;
let listener: Listener | null = null;

/** Registers the screen that should receive the outcome (onboarding / connect). */
export function onGoogleSignIn(l: Listener) {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

async function complete(code: string, state: string | undefined) {
  const p = pending;
  if (!p || p.done) return;
  if (state !== p.state) {
    listener?.({ error: new Error('Sign-in response didn’t match this request. Please try again.') });
    return;
  }
  p.done = true;
  try {
    const t = await exchangeCodeAsync(
      { clientId: p.clientId, code, redirectUri: p.redirectUri, extraParams: p.codeVerifier ? { code_verifier: p.codeVerifier } : undefined },
      discovery,
    );
    await saveTokens({
      accessToken: t.accessToken,
      refreshToken: t.refreshToken ?? undefined,
      expiresAt: Date.now() + (t.expiresIn ?? 3600) * 1000,
      clientId: p.clientId,
    });
    listener?.({ profile: await fetchProfile(t.accessToken) });
  } catch (e) {
    listener?.({ error: e instanceof Error ? e : new Error(String(e)) });
  } finally {
    pending = null;
  }
}

/**
 * Opens the Google consent screen. The outcome is delivered to the listener
 * registered with onGoogleSignIn (possibly via the oauthredirect route).
 * Returns false if the user cancelled.
 */
export async function startGoogleSignIn(request: AuthRequest, promptAsync: () => Promise<AuthSessionResult>) {
  pending = {
    state: request.state,
    codeVerifier: request.codeVerifier,
    redirectUri: request.redirectUri,
    clientId: request.clientId,
    done: false,
  };
  const res = await promptAsync();
  if (res.type === 'success' && typeof res.params.code === 'string') {
    await complete(res.params.code, res.params.state);
    return true;
  }
  if (res.type === 'error') {
    pending = null;
    throw new Error(res.error?.message ?? res.params?.error_description ?? 'Google sign-in failed');
  }
  // "dismiss"/"cancel": the redirect may still arrive as a deep link shortly.
  return new Promise<boolean>((resolve) => setTimeout(() => resolve(pending == null || pending.done), 4000));
}

/** Called by the oauthredirect route with the deep-link query params. */
export function handleOAuthRedirect(params: { code?: string; state?: string; error?: string }) {
  if (params.error) {
    pending = null;
    listener?.({ error: new Error(params.error === 'access_denied' ? 'Sign-in was cancelled.' : params.error) });
    return;
  }
  if (params.code) complete(params.code, params.state);
}
