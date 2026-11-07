import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { T, Tap } from './ui';
import { radius, space, type, useTheme } from '../theme';
import { useTags } from '../lib/hooks';
import { normalizeTags } from '../lib/documents';

/** A single #hashtag pill. Tapping it opens the library filtered by that tag. */
export function TagPill({ tag, onRemove, small, onPress }: { tag: string; onRemove?: () => void; small?: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Tap
      onPress={onPress ?? (() => router.push({ pathname: '/(tabs)/documents', params: { tag } }))}
      accessibilityLabel={`Tag ${tag}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: small ? 22 : 30,
        paddingHorizontal: small ? 8 : 12,
        borderRadius: radius.pill,
        backgroundColor: c.accentSoft,
      }}
    >
      <T v="caption" color="accent" style={{ fontWeight: '600', fontSize: small ? 11 : 13 }}>
        #{tag}
      </T>
      {onRemove && (
        <Tap onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove tag ${tag}`}>
          <Ionicons name="close" size={14} color={c.accent} />
        </Tap>
      )}
    </Tap>
  );
}

/** Hashtag editor: type "#visa", space or comma commits, suggestions from existing tags. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const { c } = useTheme();
  const all = useTags();
  const [draft, setDraft] = useState('');
  const q = draft.replace(/^#/, '').toLowerCase();
  const suggestions = all.filter((t) => !value.includes(t.tag) && (!q || t.tag.startsWith(q))).slice(0, 8);

  const commit = (text: string) => {
    const next = normalizeTags([...value, ...normalizeTags(text)]);
    onChange(next);
    setDraft('');
  };

  return (
    <View style={{ gap: 6 }}>
      <T v="caption" color="muted">
        Tags
      </T>
      <Animated.View
        layout={LinearTransition}
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space.sm,
          minHeight: 50,
          padding: space.sm,
          paddingHorizontal: space.md,
          backgroundColor: c.surface,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
        }}
      >
        {value.map((t) => (
          <Animated.View key={t} entering={FadeIn} exiting={FadeOut}>
            <TagPill tag={t} onPress={() => {}} onRemove={() => onChange(value.filter((x) => x !== t))} />
          </Animated.View>
        ))}
        <TextInput
          value={draft}
          onChangeText={(s) => (/[\s,]$/.test(s) ? commit(s) : setDraft(s))}
          onSubmitEditing={() => draft && commit(draft)}
          onKeyPress={(e) => e.nativeEvent.key === 'Backspace' && !draft && value.length && onChange(value.slice(0, -1))}
          placeholder={value.length ? 'Add tag' : '#travel #uae #renewal'}
          placeholderTextColor={c.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          submitBehavior="submit"
          returnKeyType="done"
          style={[type.body, { color: c.text, minWidth: 120, flexGrow: 1, paddingVertical: 4 }]}
        />
      </Animated.View>
      {suggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: space.sm }}>
          {suggestions.map((s) => (
            <Tap key={s.tag} onPress={() => commit(s.tag)} style={{ height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}>
              <T v="caption" color="muted">
                + #{s.tag} · {s.count}
              </T>
            </Tap>
          ))}
        </ScrollView>
      )}
      <T v="caption" color="faint">
        Press space or comma to add. Tags are encrypted and synced like everything else.
      </T>
    </View>
  );
}
