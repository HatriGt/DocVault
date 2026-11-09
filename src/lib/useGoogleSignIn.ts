import { useCallback } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { GOOGLE_SCOPES, googleClientIds, isGoogleConfigured } from './google';
import { startGoogleSignIn } from './googleSignIn';

// expo-auth-session throws during render when this platform's client ID is missing, which took
// down any screen offering Google sign-in on a build without OAuth IDs. A placeholder keeps the
// screen alive; `configured` tells it to explain instead of starting sign-in.
const UNCONFIGURED = 'not-configured.apps.googleusercontent.com';

/** The one Google sign-in request used by onboarding and "Connect Google Drive". */
export function useGoogleSignIn() {
  const configured = isGoogleConfigured();
  const [request, , promptAsync] = Google.useAuthRequest({
    androidClientId: googleClientIds.androidClientId ?? UNCONFIGURED,
    iosClientId: googleClientIds.iosClientId ?? UNCONFIGURED,
    webClientId: googleClientIds.webClientId ?? UNCONFIGURED,
    scopes: GOOGLE_SCOPES,
    selectAccount: true,
    shouldAutoExchangeCode: false, // exchanged in googleSignIn.ts (works even if the browser "dismisses")
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });
  /** Opens Google's sign-in. Resolves false if it couldn't start or the user cancelled. */
  const start = useCallback(async () => (configured && request ? startGoogleSignIn(request, promptAsync) : false), [configured, request, promptAsync]);
  return { configured, ready: configured && !!request, start };
}
