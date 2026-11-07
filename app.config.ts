import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with values that depend on the environment.
 *
 * Google OAuth on native redirects back to the app through custom URL schemes:
 *  - Android: `<applicationId>:/oauthredirect` (expo-auth-session's Google provider)
 *  - iOS: `com.googleusercontent.apps.<id>:/oauthredirect` (reversed iOS client ID)
 * If the scheme isn't registered, Android/iOS can't hand the redirect back to
 * the app and the sign-in browser just stays open.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidPackage = config.android?.package ?? 'com.hatrigt.docvault';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const reversedIos = iosClientId ? iosClientId.split('.').reverse().join('.') : null;
  const base = Array.isArray(config.scheme) ? config.scheme : config.scheme ? [config.scheme] : [];
  const scheme = [...new Set([...base, androidPackage, ...(reversedIos ? [reversedIos] : [])])];
  return { ...config, name: config.name ?? 'DocVault', slug: config.slug ?? 'docvault', scheme };
};
