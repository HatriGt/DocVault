import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { handleOAuthRedirect } from '../lib/googleSignIn';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../theme';

/**
 * Google OAuth redirects back to `<scheme>:/oauthredirect?code=…`. Expo Router
 * treats that deep link as a route, so this screen exists to receive it.
 * expo-auth-session's pending promptAsync() already captured the URL; we only
 * need to step back to the screen that started sign-in.
 */
export default function OAuthRedirect() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    handleOAuthRedirect({ code: params.code, state: params.state, error: params.error });
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}
