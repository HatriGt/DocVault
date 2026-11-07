import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
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
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}
