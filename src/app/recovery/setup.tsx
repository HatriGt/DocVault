import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button, Field, Screen, T } from '../../components/ui';
import { radius, space, type, useTheme, fonts } from '../../theme';
import { getPendingAccount } from '../../lib/pending';
import { setUpNewVault } from '../../lib/vault';
import { seedSampleVault } from '../../lib/sampleVault';
import { registerBackgroundSync } from '../../lib/backgroundSync';
import { normalizeRecoveryKey } from '../../lib/crypto';

type Step = 'intro' | 'working' | 'show' | 'confirm' | 'profile';

export default function RecoverySetup() {
  const { c } = useTheme();
  const account = getPendingAccount();
  const [step, setStep] = useState<Step>('intro');
  const [key, setKey] = useState('');
  const [check, setCheck] = useState('');
  const [name, setName] = useState(account?.displayName ?? '');
  const [samples, setSamples] = useState(true);
  const [finishing, setFinishing] = useState(false);

  if (!account) {
    router.replace('/onboarding');
    return null;
  }

  const generate = async () => {
    setStep('working');
    try {
      const k = await setUpNewVault({ ...account, displayName: account.displayName || 'there' });
      setKey(k);
      setStep('show');
    } catch (e) {
      Alert.alert('Couldn’t create your vault', e instanceof Error ? e.message : String(e));
      setStep('intro');
    }
  };

  const lastGroup = key.split('-').slice(-1)[0];
  const confirmOk = normalizeRecoveryKey(check) === lastGroup;

  const finish = async () => {
    setFinishing(true);
    try {
      const { setAccount } = await import('../../lib/session');
      const displayName = name.trim() || account.profile?.name?.split(' ')[0] || 'there';
      await setAccount({ ...account, displayName });
      if (samples) await seedSampleVault(account.profile?.name ?? (name.trim() || 'Alex Morgan'));
      if (account.mode === 'google') registerBackgroundSync();
      router.replace('/(tabs)');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space.xxl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {step === 'intro' && (
          <Animated.View entering={FadeIn} style={{ flex: 1 }}>
            <Badge icon="key" />
            <T v="title" style={{ marginTop: space.xl }}>
              Your recovery key
            </T>
            <T v="body" color="muted" style={{ marginTop: space.md }}>
              DocVault uses zero-knowledge encryption. Your documents are locked with a key that only you hold.
            </T>
            <View style={{ marginTop: space.xxl, gap: space.lg }}>
              <Point icon="phone-portrait-outline" text="On this phone, the key is protected by the Secure Enclave / Android Keystore." />
              <Point icon="refresh-outline" text="If you lose your phone, your recovery key restores everything on a new device." />
              <Point icon="alert-circle-outline" text="We can’t reset it for you. Without it, a lost vault can’t be decrypted — by anyone." />
            </View>
            <View style={{ flex: 1 }} />
            <Button title="Create my recovery key" onPress={generate} style={{ marginTop: space.xxxl }} />
          </Animated.View>
        )}

        {step === 'working' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
            <ActivityIndicator color={c.accent} size="large" />
            <T v="bodyStrong">Generating keys on your device…</T>
          </View>
        )}

        {step === 'show' && (
          <Animated.View entering={FadeIn} style={{ flex: 1 }}>
            <Badge icon="key" />
            <T v="title" style={{ marginTop: space.xl }}>
              Write this down
            </T>
            <T v="body" color="muted" style={{ marginTop: space.md }}>
              Store it somewhere safe and offline — a password manager or on paper. It’s shown only once.
            </T>
            <View
              style={{
                marginTop: space.xxl,
                backgroundColor: c.surface,
                borderRadius: radius.lg,
                padding: space.xl,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: space.md,
                justifyContent: 'center',
              }}
              accessibilityLabel={`Recovery key ${key.split('').join(' ')}`}
            >
              {key.split('-').map((g, i) => (
                <View key={i} style={{ width: '22%', alignItems: 'center', paddingVertical: space.sm, backgroundColor: c.surfaceAlt, borderRadius: radius.sm }}>
                  <T v="mono" selectable style={{ fontFamily: fonts.bold }}>
                    {g}
                  </T>
                </View>
              ))}
            </View>
            <Button
              title="Save to password manager"
              icon="share-outline"
              variant="ghost"
              onPress={() => Share.share({ message: `DocVault recovery key: ${key}` })}
              style={{ marginTop: space.md }}
            />
            <View style={{ flex: 1 }} />
            <Button title="I’ve saved it" onPress={() => setStep('confirm')} style={{ marginTop: space.xl }} />
          </Animated.View>
        )}

        {step === 'confirm' && (
          <Animated.View entering={FadeIn} style={{ flex: 1 }}>
            <Badge icon="checkmark-done" />
            <T v="title" style={{ marginTop: space.xl }}>
              Confirm your key
            </T>
            <T v="body" color="muted" style={{ marginTop: space.md, marginBottom: space.xl }}>
              Enter the last 4 characters of your recovery key.
            </T>
            <Field
              label="Last group"
              value={check}
              onChangeText={setCheck}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
              placeholder="XXXX"
              style={[type.mono, { textAlign: 'center', fontSize: 22 }]}
            />
            <View style={{ flex: 1 }} />
            <Button title="Back" variant="ghost" onPress={() => setStep('show')} style={{ marginTop: space.xl }} />
            <Button
              title="Confirm"
              disabled={!confirmOk}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                setStep('profile');
              }}
            />
          </Animated.View>
        )}

        {step === 'profile' && (
          <Animated.View entering={FadeIn} style={{ flex: 1, gap: space.xl }}>
            <Badge icon="sparkles" />
            <T v="title">Almost there</T>
            {account.mode === 'local' && (
              <Field label="What should we call you?" value={name} onChangeText={setName} placeholder="Your first name" autoFocus />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">Add sample documents</T>
                <T v="caption" color="muted">
                  Explore with a few realistic, clearly-labelled examples. Delete them anytime.
                </T>
              </View>
              <Switch value={samples} onValueChange={setSamples} trackColor={{ true: c.accent }} />
            </View>
            <View style={{ flex: 1 }} />
            <Button title="Open my vault" onPress={finish} loading={finishing} />
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Badge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={28} color={c.accent} />
    </View>
  );
}

export function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={22} color={c.accent} />
      <T v="body" style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}
