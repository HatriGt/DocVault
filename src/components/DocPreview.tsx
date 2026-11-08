import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { DocThumb } from './docs';
import { elevation, radius, useTheme } from '../theme';
import { DUR } from '../theme/motion';
import type { DocRecord } from '../lib/db';
import { decryptDocument } from '../lib/documents';
import { deleteTemp, writeTempPlain } from '../lib/blobs';
import { resolveType } from '../lib/filetype';
import { isUnlocked } from '../lib/guard';

/**
 * Real preview for the document page: first page of a PDF or the photo itself.
 * Falls back to the generic thumbnail for other formats and for locked documents.
 */
export function DocPreview({ doc, width }: { doc: DocRecord; width: number }) {
  const { c } = useTheme();
  const [file, setFile] = useState<{ uri: string; kind: 'pdf' | 'image' } | null>(null);
  const [failed, setFailed] = useState(false);
  const previewable = (doc.mime === 'application/pdf' || doc.mime.startsWith('image/')) && isUnlocked(doc);

  useEffect(() => {
    if (!previewable) return;
    let alive = true;
    let own: string | null = null;
    (async () => {
      try {
        const plain = await decryptDocument(doc);
        const t = resolveType(plain, `${doc.name}.${doc.ext}`, doc.mime);
        const kind = t.mime === 'application/pdf' ? 'pdf' : t.mime.startsWith('image/') ? 'image' : null;
        if (!kind) throw new Error('not previewable');
        own = writeTempPlain(`preview-${doc.id}.${t.ext}`, plain).uri;
        if (alive) setFile({ uri: own, kind });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      if (own) deleteTemp(own);
    };
    // Re-run only when the document or its content changes.
  }, [doc.id, doc.content_hash, previewable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!previewable || failed) return <DocThumb doc={doc} size={Math.min(width * 0.55, 220)} />;

  const w = Math.min(width * 0.5, 210);
  const h = w * 1.36;
  return (
    <View style={[{ width: w, height: h, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }, elevation(c, 3)]}>
      {!file ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(DUR.base)} style={{ flex: 1 }}>
          {file.kind === 'pdf' ? (
            <Pdf
              source={{ uri: file.uri }}
              singlePage
              page={1}
              fitPolicy={0}
              enablePaging={false}
              scrollEnabled={false}
              style={{ flex: 1, backgroundColor: c.surface }}
              renderActivityIndicator={() => <ActivityIndicator color={c.accent} />}
              onError={() => setFailed(true)}
            />
          ) : (
            <Image source={{ uri: file.uri }} style={{ flex: 1 }} contentFit="cover" cachePolicy="none" />
          )}
        </Animated.View>
      )}
    </View>
  );
}
