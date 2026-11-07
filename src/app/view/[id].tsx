import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, T } from '../../components/ui';
import { AudioViewer, HtmlView, ImageView, Message, PdfView, SheetView, VideoViewer } from '../../components/viewers';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { decryptDocument, markAccessed, openNative, shareDocument } from '../../lib/documents';
import { purgeTempPlain, writeTempPlain } from '../../lib/blobs';
import { resolveType, viewKind, ViewKind } from '../../lib/filetype';
import { textToHtml, wordToHtml } from '../../lib/officeRender';
import { formatBytes } from '../../lib/format';

interface Loaded {
  kind: ViewKind;
  uri?: string;
  html?: string;
  bytes?: Uint8Array;
  ext: string;
  mime: string;
}

const DARK_KINDS: ViewKind[] = ['image', 'video'];

/** Universal in-app viewer: PDF, images, video, audio, Word, spreadsheets, text — or a graceful fallback. */
export default function Viewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    (async () => {
      try {
        const plain = await decryptDocument(doc);
        const t = resolveType(plain, `${doc.name}.${doc.ext}`, doc.mime);
        const kind = viewKind(t.mime, t.ext);
        const base = doc.name.replace(/\.[a-z0-9]{1,5}$/i, '') || 'document';
        let out: Loaded = { kind, ext: t.ext, mime: t.mime };
        if (kind === 'pdf' || kind === 'image' || kind === 'video' || kind === 'audio') {
          out.uri = writeTempPlain(`${base}.${t.ext}`, plain).uri;
        } else if (kind === 'word') {
          out.html = await wordToHtml(plain, dark);
        } else if (kind === 'text') {
          out.html = textToHtml(plain, dark);
        } else if (kind === 'sheet') {
          out.bytes = plain;
        }
        markAccessed(doc.id);
        if (alive) setData(out);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      purgeTempPlain(); // never leave plaintext behind
    };
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const darkChrome = data ? DARK_KINDS.includes(data.kind) : false;
  const fg = darkChrome ? '#fff' : c.text;
  const btnBg = darkChrome ? 'rgba(255,255,255,0.16)' : undefined;

  const openWith = () => openNative(doc).catch((e) => Alert.alert('No app can open this', e instanceof Error ? e.message : String(e)));

  return (
    <View style={{ flex: 1, backgroundColor: darkChrome ? '#000' : c.bg }}>
      <StatusBar style={darkChrome || dark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, zIndex: 2 }}>
        <IconButton icon="chevron-down" label="Close" onPress={() => router.back()} bg={btnBg} tint={fg} />
        <View style={{ flex: 1 }}>
          <T v="bodyStrong" color={fg} numberOfLines={1}>
            {doc.name}
          </T>
          <T v="caption" color={darkChrome ? 'rgba(255,255,255,0.7)' : 'muted'}>
            {(data?.ext ?? doc.ext).toUpperCase()} · {formatBytes(doc.size)}
          </T>
        </View>
        <IconButton icon="open-outline" label="Open with another app" onPress={openWith} bg={btnBg} tint={fg} />
        <IconButton icon="share-outline" label="Share" onPress={() => shareDocument(doc).catch(() => {})} bg={btnBg} tint={fg} />
      </View>

      <Animated.View key={data?.kind ?? 'loading'} entering={FadeIn.duration(220)} style={{ flex: 1 }}>
        {error ? (
          <Message icon="alert-circle-outline" text={error} />
        ) : !data ? (
          <Message loading text="Decrypting…" />
        ) : data.kind === 'pdf' ? (
          <PdfView uri={data.uri!} />
        ) : data.kind === 'image' ? (
          <ImageView uri={data.uri!} />
        ) : data.kind === 'video' ? (
          <VideoViewer uri={data.uri!} />
        ) : data.kind === 'audio' ? (
          <AudioViewer uri={data.uri!} title={doc.name} />
        ) : data.kind === 'sheet' ? (
          <SheetView bytes={data.bytes!} ext={data.ext} />
        ) : data.html ? (
          <HtmlView html={data.html} />
        ) : (
          <Fallback ext={data.ext} onOpen={openWith} onShare={() => shareDocument(doc).catch(() => {})} />
        )}
      </Animated.View>
    </View>
  );
}

/** For formats with no offline renderer (e.g. PowerPoint, archives). */
function Fallback({ ext, onOpen, onShare }: { ext: string; onOpen: () => void; onShare: () => void }) {
  const { c } = useTheme();
  const icon: keyof typeof Ionicons.glyphMap = ['ppt', 'pptx', 'key', 'odp'].includes(ext) ? 'easel' : ['zip', 'rar', '7z'].includes(ext) ? 'archive' : 'document';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg }}>
      <Animated.View entering={FadeInDown.springify()} style={[{ width: 132, height: 160, borderRadius: radius.lg, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: space.sm }, elevation(c, 2)]}>
        <Ionicons name={icon} size={52} color={c.accent} />
        <T v="overline" color="accent" style={{ fontFamily: fonts.extrabold }}>
          {ext.toUpperCase() || 'FILE'}
        </T>
      </Animated.View>
      <T v="heading" style={{ textAlign: 'center' }}>
        Preview isn’t available for this format
      </T>
      <T v="callout" color="muted" style={{ textAlign: 'center' }}>
        It’s stored safely and encrypted. Open it with another app on your phone, or share it.
      </T>
      <View style={{ alignSelf: 'stretch', gap: space.md, marginTop: space.md }}>
        <Button title="Open with…" icon="open-outline" onPress={onOpen} />
        <Button title="Share" icon="share-outline" variant="secondary" onPress={onShare} />
      </View>
    </View>
  );
}
