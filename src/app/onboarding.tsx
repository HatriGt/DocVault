import React, { useRef, useState } from 'react';
import { Alert, FlatList, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Screen, T, Tap } from '../components/ui';
import { radius, space, useTheme } from '../theme';
import { GOOGLE_SCOPES, googleClientIds, isGoogleConfigured } from '../lib/google';
import { completeGoogleSignIn } from '../lib/googleSignIn';
import { lookupExistingVault } from '../lib/vault';
import { setPendingAccount } from '../lib/pending';

WebBrowser.maybeCompleteAuthSession();

const SLIDES = [
  {
    icon: 'shield-checkmark' as const,
    title: 'Encrypted before it\nleaves your phone',
    body: 'Every document is locked with AES-256 on this device. Google Drive only ever stores scrambled data — not even Google can read it.',
  },
  {
    icon: 'airplane' as const,
    title: 'Always with you,\neven offline',
    body: 'Your passport at the gate, your licence at the roadside. Documents stay on your device and open instantly without a connection.',
  },
  {
    icon: 'paper-plane' as const,
    title: 'Share in two taps',
    body: 'Send a single document with AirDrop, Quick Share or any app — without ever exposing the rest of your vault.',
  },
];

export default function Onboarding() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const [busy, setBusy] = useState(false);

  const [request, , promptAsync] = Google.useAuthRequest({
    ...googleClientIds,
    scopes: GOOGLE_SCOPES,
    selectAccount: true,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  const signInGoogle = async () => {
    if (!isGoogleConfigured()) {
      Alert.alert(
        'Google isn’t configured',
        'Add your OAuth client IDs to .env (see README) to enable Google Drive backup. You can continue on this device only for now.',
      );
      return;
    }
    setBusy(true);
    try {
      const profile = await completeGoogleSignIn(await promptAsync(), request?.clientId ?? '');
      if (!profile) return;
      setPendingAccount({ mode: 'google', profile, displayName: profile.name.split(' ')[0] });
      const existing = await lookupExistingVault();
      router.replace(existing ? '/recovery/restore' : '/recovery/setup');
    } catch (e) {
      Alert.alert('Couldn’t connect Google Drive', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const localOnly = () => {
    setPendingAccount({ mode: 'local', displayName: '' });
    router.replace('/recovery/setup');
  };

  const last = page === SLIDES.length;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, height: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="lock-closed" size={17} color={c.onAccent} />
          </View>
          <T v="heading">DocVault</T>
        </View>
        {!last && (
          <Tap onPress={() => list.current?.scrollToIndex({ index: SLIDES.length })} hitSlop={10}>
            <T v="callout" color="muted">
              Skip
            </T>
          </Tap>
        )}
      </View>

      <FlatList
        ref={list}
        data={[...SLIDES, null]}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) =>
          item ? (
            <View style={{ width, paddingHorizontal: space.xxl, justifyContent: 'center' }}>
              <Hero icon={item.icon} />
              <T v="display" style={{ marginTop: space.xxxl }}>
                {item.title}
              </T>
              <T v="body" color="muted" style={{ marginTop: space.lg }}>
                {item.body}
              </T>
            </View>
          ) : (
            <View style={{ width, paddingHorizontal: space.xxl, justifyContent: 'center' }}>
              <Animated.View entering={FadeInDown.duration(400)}>
                <T v="display">Let’s set up{'\n'}your vault</T>
                <T v="body" color="muted" style={{ marginTop: space.lg }}>
                  Sign in with Google to back up your encrypted vault to your own Google Drive and sync it across devices.
                </T>
                <View style={{ marginTop: space.xxxl, gap: space.md }}>
                  <Button title="Continue with Google" icon="logo-google" onPress={signInGoogle} loading={busy} disabled={!request && isGoogleConfigured()} />
                  <Button title="Use on this device only" variant="secondary" onPress={localOnly} />
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xl, alignItems: 'flex-start' }}>
                  <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
                  <T v="caption" color="muted" style={{ flex: 1 }}>
                    DocVault can only access its own hidden folder in your Drive — never your other files. Your Google password never unlocks your documents; your recovery key does.
                  </T>
                </View>
              </Animated.View>
            </View>
          )
        }
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: space.lg }}>
        {[...SLIDES, null].map((_, i) => (
          <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? c.accent : c.surfaceAlt }} />
        ))}
      </View>
      {!last && (
        <View style={{ paddingHorizontal: space.xxl, paddingBottom: space.md }}>
          <Button title="Continue" onPress={() => list.current?.scrollToIndex({ index: page + 1 })} />
        </View>
      )}
    </Screen>
  );
}

function Hero({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { c } = useTheme();
  return (
    <View style={{ height: 260, alignItems: 'center', justifyContent: 'center' }}>
      {[220, 160, 100].map((s, i) => (
        <View
          key={s}
          style={{
            position: 'absolute',
            width: s,
            height: s,
            borderRadius: s / 2,
            backgroundColor: c.accent,
            opacity: [0.06, 0.1, 0.16][i],
          }}
        />
      ))}
      <View style={{ width: 88, height: 88, borderRadius: radius.xl, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={42} color={c.onAccent} />
      </View>
    </View>
  );
}
