import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T, Tap } from '../../components/ui';
import { PassportBook, WalletCard } from '../../components/docs';
import { ImageView, PdfView } from '../../components/viewers';
import { fonts, space } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { CARD_TYPES } from '../../lib/categories';
import { decryptDocument, parseFields } from '../../lib/documents';
import { deleteTemp, writeTempPlain } from '../../lib/blobs';
import { resolveType } from '../../lib/filetype';
import { formatDate } from '../../lib/format';
import { DUR, EASE_OUT } from '../../theme/motion';

/**
 * Present mode: show a document at a counter or checkpoint — full brightness,
 * screen kept awake, distraction-free dark stage. Brightness restores on exit.
 */
export default function Present() {
  useKeepAwake('present');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<{ uri: string; kind: 'image' | 'pdf' | 'card' } | null>(null);
  const flip = useSharedValue(0);

  useEffect(() => {
    let prev: number | null = null;
    Brightness.getBrightnessAsync()
      .then((b) => {
        prev = b;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => {});
    return () => {
      if (prev != null) Brightness.setBrightnessAsync(prev).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    let ownUri: string | null = null;
    (async () => {
      let next: { uri: string; kind: 'image' | 'pdf' | 'card' } = { uri: '', kind: 'card' };
      if (!(CARD_TYPES.has(doc.doc_type ?? '') && !doc.mime.startsWith('image/'))) {
        try {
          const plain = await decryptDocument(doc);
          const t = resolveType(plain, `${doc.name}.${doc.ext}`, doc.mime);
          const kind = t.mime === 'application/pdf' ? 'pdf' : t.mime.startsWith('image/') ? 'image' : 'card';
          next = { uri: kind === 'card' ? '' : (ownUri = writeTempPlain(`present-${doc.id}.${t.ext}`, plain).uri), kind };
        } catch {}
      }
      if (alive) setFile(next);
    })();
    return () => {
      alive = false;
      if (ownUri) deleteTemp(ownUri);
    };
    // Depend on the id only: decrypting a cloud-only doc updates the row, which would re-run this effect.
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.get(), [0, 1], [0, 180])}deg` }], backfaceVisibility: 'hidden' }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 1200 }, { rotateY: `${interpolate(flip.get(), [0, 1], [180, 360])}deg` }], backfaceVisibility: 'hidden' }));

  if (!doc) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  const f = parseFields(doc);
  const cardW = width - space.xl * 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#07060D' }}>
      <StatusBar style="light" hidden />
      <View style={{ position: 'absolute', zIndex: 5, top: insets.top + space.sm, left: space.xl, right: space.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} bg="rgba(255,255,255,0.14)" tint="#fff" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, height: 30, borderRadius: 15 }}>
          <Ionicons name="sunny" size={14} color="#FFD66B" />
          <T v="caption" color="#fff">
            Max brightness · screen stays on
          </T>
        </View>
      </View>

      {!file ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : file.kind === 'image' ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <ImageView uri={file.uri} />
        </View>
      ) : file.kind === 'pdf' ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <PdfView uri={file.uri} />
        </View>
      ) : (
        <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl, paddingHorizontal: space.xl }}>
          {doc.doc_type === 'Passport' ? (
            <Animated.View entering={ZoomIn.duration(DUR.slow).easing(EASE_OUT)}>
              <PassportBook doc={doc} width={Math.min(width * 0.62, 280)} />
            </Animated.View>
          ) : (
            <Tap onPress={() => flip.set(withTiming(flip.get() > 0.5 ? 0 : 1, { duration: 450 }))} scaleTo={0.98} style={{ width: cardW, height: cardW / 1.586 }}>
              <Animated.View entering={ZoomIn.duration(DUR.slow).easing(EASE_OUT)} style={[StyleSheet.absoluteFill, front]}>
                <WalletCard doc={doc} width={cardW} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, back]}>
                <WalletCard doc={doc} width={cardW} side="back" />
              </Animated.View>
            </Tap>
          )}
          <View style={{ alignItems: 'center', gap: space.sm }}>
            {f.holder && (
              <T v="heading" color="#fff" style={{ fontSize: 22 }}>
                {f.holder}
              </T>
            )}
            {f.number && (
              <T v="mono" color="#fff" selectable style={{ fontSize: 30, letterSpacing: 3, fontFamily: fonts.extrabold }}>
                {f.number}
              </T>
            )}
            {doc.expiry && (
              <T v="callout" color="rgba(255,255,255,0.7)">
                Valid until {formatDate(doc.expiry)}
              </T>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
