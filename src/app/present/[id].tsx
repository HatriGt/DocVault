import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Brightness from 'expo-brightness';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FadeIn, ZoomIn } from '../../theme/anim';
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The decrypted file (null while loading; kind null if it can't be shown). Card-type documents also
  // get a drawn card + large facts view, which is the default for them.
  const [file, setFile] = useState<{ uri: string; kind: 'image' | 'pdf' | null } | null>(null);
  const [view, setView] = useState<'card' | 'file' | null>(null);
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
      let next: { uri: string; kind: 'image' | 'pdf' | null } = { uri: '', kind: null };
      try {
        const plain = await decryptDocument(doc);
        const t = resolveType(plain, `${doc.name}.${doc.ext}`, doc.mime);
        const kind = t.mime === 'application/pdf' ? 'pdf' : t.mime.startsWith('image/') ? 'image' : null;
        next = { uri: kind ? (ownUri = writeTempPlain(`present-${doc.id}.${t.ext}`, plain).uri) : '', kind };
      } catch {}
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
  const isCard = CARD_TYPES.has(doc.doc_type ?? '');
  const shown = view ?? (isCard ? 'card' : 'file');
  const canSwitch = isCard && !!file?.kind;
  const bookW = Math.min(width * 0.62, 280, height * 0.3);
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

      {shown === 'file' && !file ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : shown === 'file' && file?.kind === 'image' ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <ImageView uri={file.uri} />
        </View>
      ) : shown === 'file' && file?.kind === 'pdf' ? (
        <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
          <PdfView uri={file.uri} />
        </View>
      ) : (
        <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingBottom: canSwitch ? 96 : 0 }}>
          {/* One group, explicit spacing: the card/passport, a fixed gap, then the facts. */}
          <View style={{ alignItems: 'center' }}>
          {doc.doc_type === 'Passport' ? (
            // Fixed-size box so the facts below are laid out against the passport's real height.
            <View style={{ width: bookW, height: bookW * 1.4 }}>
              <Animated.View entering={ZoomIn.duration(DUR.slow).easing(EASE_OUT)}>
                <PassportBook doc={doc} width={bookW} />
              </Animated.View>
            </View>
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
          <View style={{ height: space.xxl }} />
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
          </View>
        </Animated.View>
      )}

      {canSwitch && (
        <View style={{ position: 'absolute', bottom: insets.bottom + space.xl, alignSelf: 'center', flexDirection: 'row', backgroundColor: 'rgba(7,6,13,0.9)', borderRadius: 22, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
          {(['card', 'file'] as const).map((v) => (
            <Tap
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: shown === v }}
              accessibilityLabel={v === 'card' ? 'Show card and details' : 'Show the document'}
              style={{ height: 36, paddingHorizontal: space.lg, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: shown === v ? '#fff' : 'transparent' }}
            >
              <T v="callout" color={shown === v ? '#07060D' : '#fff'} style={{ fontFamily: fonts.semibold }}>
                {v === 'card' ? 'Card' : 'Document'}
              </T>
            </Tap>
          ))}
        </View>
      )}
    </View>
  );
}
