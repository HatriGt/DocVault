import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Button, T } from '../../components/ui';
import { space, useTheme } from '../../theme';

const PRIVACY_URL = 'https://hatrigt.github.io/DocVault/privacy.html';

const ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'lock-closed', title: 'Encrypted on your device', body: 'Every file is encrypted with its own random 256-bit key using AES-256-GCM before it’s written to storage or uploaded.' },
  { icon: 'eye-off', title: 'Zero knowledge', body: 'Google Drive only receives ciphertext and encrypted metadata — even file names are hidden. Neither Google nor DocVault can read your documents.' },
  { icon: 'key', title: 'Keys stay with you', body: 'Your vault key lives in the iOS Keychain or Android Keystore. A copy protected by your recovery key (via scrypt) lets you restore on a new device.' },
  { icon: 'logo-google', title: 'Separate from Google login', body: 'Signing into Google only grants access to encrypted data in a hidden app folder. It can never unlock your vault on its own.' },
  { icon: 'phone-portrait', title: 'No tracking', body: 'DocVault has no analytics, ads or servers of its own. OCR and classification run entirely on your device.' },
  { icon: 'share-social', title: 'You control sharing', body: 'Nothing is shared without you tapping Share. Decrypted copies created for sharing are deleted automatically.' },
];

export default function Privacy() {
  const { c } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: 'Privacy & security' }} />
      {ITEMS.map((i) => (
        <View key={i.title} style={{ flexDirection: 'row', gap: space.lg }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={i.icon} size={19} color={c.accent} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="bodyStrong">{i.title}</T>
            <T v="callout" color="muted">
              {i.body}
            </T>
          </View>
        </View>
      ))}
      <Button
        title="Read the full privacy policy"
        variant="secondary"
        icon="open-outline"
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
      />
    </ScrollView>
  );
}
