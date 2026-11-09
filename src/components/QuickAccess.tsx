import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, T, Tap } from './ui';
import { BottomSheet } from './Sheet';
import { KeyFacts, useKeyFacts } from './KeyFacts';
import { cardSkin } from './docs';
import { noTabSwipe } from './TabSwipe';
import { fonts, space, useTheme } from '../theme';
import type { DocRecord } from '../lib/db';
import { presentDoc } from '../lib/actions';

const ITEM = 72;

/**
 * Home's quick access to Wallet documents: a slim row of icons. Tapping one "peeks" — a sheet with
 * the facts you need at a counter (number, expiry, holder) and Present / Open — without leaving Home.
 */
export function QuickAccess({ docs, onLongPress }: { docs: DocRecord[]; onLongPress?: (d: DocRecord) => void }) {
  const [peek, setPeek] = useState<DocRecord | null>(null);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} {...noTabSwipe} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}>
        {docs.map((d) => (
          <QuickItem key={d.id} doc={d} onPress={() => setPeek(d)} onLongPress={onLongPress && (() => onLongPress(d))} />
        ))}
      </ScrollView>
      <Peek doc={peek} onClose={() => setPeek(null)} />
    </>
  );
}

function QuickItem({ doc, onPress, onLongPress }: { doc: DocRecord; onPress: () => void; onLongPress?: () => void }) {
  const { c } = useTheme();
  const skin = cardSkin(doc, c);
  return (
    <Tap onPress={onPress} onLongPress={onLongPress} scaleTo={0.94} accessibilityLabel={`${doc.name}: show details`} style={{ width: ITEM, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: skin.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
        <Ionicons name={skin.icon} size={24} color={skin.fg} />
      </View>
      <T v="caption" numberOfLines={1} style={{ fontFamily: fonts.semibold, maxWidth: ITEM }}>
        {doc.name}
      </T>
    </Tap>
  );
}

function Peek({ doc, onClose }: { doc: DocRecord | null; onClose: () => void }) {
  const { c } = useTheme();
  // Keep the last document while the sheet animates out.
  const [shown, setShown] = useState<DocRecord | null>(doc);
  if (doc && doc !== shown) setShown(doc);
  const facts = useKeyFacts(shown);
  const skin = shown ? cardSkin(shown, c) : null;
  const go = (fn: () => void) => {
    onClose();
    setTimeout(fn, 220);
  };
  return (
    <BottomSheet visible={!!doc} onClose={onClose}>
      {shown && skin && (
        <View style={{ paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: skin.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={skin.icon} size={20} color={skin.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="heading" numberOfLines={1}>
                {shown.name}
              </T>
              {!!shown.doc_type && (
                <T v="caption" color="muted">
                  {shown.doc_type}
                </T>
              )}
            </View>
          </View>
          {facts.length > 0 ? (
            <KeyFacts facts={facts} />
          ) : (
            <T v="callout" color="muted">
              No details saved yet — add the number and expiry from the document page.
            </T>
          )}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button title="Present" icon="expand-outline" variant="secondary" style={{ flex: 1 }} onPress={() => go(() => presentDoc(shown))} />
            <Button title="Open" icon="eye-outline" style={{ flex: 1 }} onPress={() => go(() => router.push(`/doc/${shown.id}`))} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
