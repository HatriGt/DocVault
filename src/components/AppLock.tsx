import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { FadeIn, FadeOut } from '../theme/anim';
import { getPrefs } from '../lib/session';
import { lockKeysInMemory, verifyPin } from '../lib/keys';
import { purgeTempPlain } from '../lib/blobs';
import { relockAll } from '../lib/guard';
import { radius, space, useTheme } from '../theme';
import { T, Tap } from './ui';

const clock = () => Date.now();

/** Full-screen privacy shield + biometric / PIN lock. */
export function AppLock({ children }: { children: React.ReactNode }) {
  // null = prefs not loaded yet → show the shield, so vault content never flashes on cold start.
  const [locked, setLocked] = useState<boolean | null>(null);
  const [shield, setShield] = useState(false);
  const bgAt = useRef<number | null>(null);

  const shouldLock = useCallback(async () => {
    const p = await getPrefs();
    return p.biometricLock || p.pinLock;
  }, []);

  useEffect(() => {
    shouldLock().then(setLocked);
    const sub = AppState.addEventListener('change', async (s) => {
      if (s === 'inactive' || s === 'background') {
        setShield(true); // hides content in the app switcher
        if (bgAt.current == null) bgAt.current = Date.now();
      } else if (s === 'active') {
        setShield(false);
        const p = await getPrefs();
        const away = bgAt.current ? (Date.now() - bgAt.current) / 1000 : 0;
        bgAt.current = null;
        if (away >= 60) purgeTempPlain(); // drop decrypted leftovers after a real absence
        if ((p.biometricLock || p.pinLock) && away >= p.lockAfterSeconds) {
          lockKeysInMemory();
          relockAll();
          purgeTempPlain();
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [shouldLock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {(locked !== false || shield) && (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
          <LockScreen showControls={locked === true} onUnlock={() => setLocked(false)} />
        </Animated.View>
      )}
    </View>
  );
}

function LockScreen({ onUnlock, showControls }: { onUnlock: () => void; showControls: boolean }) {
  const { c } = useTheme();
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [hasBio, setHasBio] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [remaining, setRemaining] = useState(0); // seconds left in the PIN back-off
  useEffect(() => {
    if (!waitUntil) return;
    const tick = () => {
      const left = Math.ceil((waitUntil - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) setWaitUntil(0);
    };
    const t = setInterval(tick, 500);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [waitUntil]);
  const waiting = waitUntil !== 0 && remaining > 0;
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const tryBiometric = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock DocVault',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    if (r.success) onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    if (!showControls) return;
    (async () => {
      const p = await getPrefs();
      setPinEnabled(p.pinLock);
      const bio = p.biometricLock && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setHasBio(!!bio);
      if (bio) tryBiometric();
      else setPinMode(true);
    })();
  }, [showControls, tryBiometric]);

  const press = async (d: string) => {
    if (waiting) return;
    Haptics.selectionAsync().catch(() => {});
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (next.length === 6) {
      if (await verifyPin(next)) {
        setFails(0);
        onUnlock();
      } else {
        const n = fails + 1;
        setFails(n);
        // After 5 wrong PINs: 30s, 60s, 120s… between attempts.
        if (n >= 5) {
          const ms = 30_000 * 2 ** Math.min(n - 5, 5);
          setRemaining(Math.ceil(ms / 1000));
          setWaitUntil(clock() + ms);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        shake.set(withSequence(...[-10, 10, -8, 8, 0].map((x) => withTiming(x, { duration: 50 }))));
        setPin('');
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
      <Image source={require('../../assets/logo.png')} style={{ width: 96, height: 96 }} contentFit="contain" />
      <T v="title" style={{ marginTop: space.xl }}>
        DocVault is locked
      </T>
      {showControls && (
        <>
          {pinMode && pinEnabled ? (
            <>
              {waiting && (
                <T v="callout" color="danger" style={{ marginTop: space.lg }}>
                  Too many attempts. Try again in {remaining}s
                </T>
              )}
              <Animated.View style={[{ flexDirection: 'row', gap: space.md, marginVertical: space.xxl }, shakeStyle]}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < pin.length ? c.accent : c.surfaceAlt }}
                  />
                ))}
              </Animated.View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 276, gap: space.lg, justifyContent: 'center' }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((k) => (
                  <Tap
                    key={k}
                    debounce={false}
                    accessibilityLabel={k === 'bio' ? 'Use biometrics' : k === 'del' ? 'Delete' : k}
                    onPress={() => (k === 'del' ? setPin(pin.slice(0, -1)) : k === 'bio' ? hasBio && tryBiometric() : press(k))}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      backgroundColor: k === 'bio' || k === 'del' ? 'transparent' : c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {k === 'del' ? (
                      <Ionicons name="backspace-outline" size={26} color={c.text} />
                    ) : k === 'bio' ? (
                      hasBio ? <Ionicons name="finger-print" size={28} color={c.accent} /> : null
                    ) : (
                      <T v="title">{k}</T>
                    )}
                  </Tap>
                ))}
              </View>
            </>
          ) : (
            <Tap
              onPress={tryBiometric}
              style={{
                marginTop: space.xxl,
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'center',
                backgroundColor: c.accent,
                paddingHorizontal: space.xl,
                height: 52,
                borderRadius: radius.pill,
              }}
            >
              <Ionicons name="finger-print" size={22} color={c.onAccent} />
              <T v="bodyStrong" color="onAccent">
                Unlock
              </T>
            </Tap>
          )}
          {!pinMode && pinEnabled && (
            <Tap onPress={() => setPinMode(true)} style={{ marginTop: space.lg }}>
              <T v="callout" color="accent">
                Use PIN instead
              </T>
            </Tap>
          )}
        </>
      )}
    </View>
  );
}
