import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useIncomingShare } from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Field, IconButton, T } from '../components/ui';
import { DetailsForm, expiryValid, FormState, normalizeExpiry } from '../components/DetailsForm';
import { FileStack, StackFile } from '../components/FileStack';
import { SaveSuccess } from '../components/SaveSuccess';
import { TagInput } from '../components/Tags';
import { elevation, fonts, radius, space, useTheme } from '../theme';
import { useAccount, useCategories } from '../lib/hooks';
import { hasLocalVaultKey } from '../lib/keys';
import { importDocument } from '../lib/documents';
import { prettifyName, suggest } from '../lib/classify';
import { formatBytes } from '../lib/format';

type Phase = 'form' | 'saving' | 'done';
type Item = StackFile & { size: number | null; status: 'pending' | 'working' | 'done' | 'error'; id?: string; error?: string };

const SUPPORTED = (mime: string) => mime === 'application/pdf' || mime.startsWith('image/');

/** "Add to DocVault" — receives files shared from WhatsApp, Files, Gallery, etc. */
export default function ShareInto() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { resolvedSharedPayloads, isResolving, clearSharedPayloads, error } = useIncomingShare();
  const { account, loading: accountLoading } = useAccount();
  const categories = useCategories();
  const [vaultReady, setVaultReady] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [category, setCategory] = useState('personal');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    hasLocalVaultKey().then(setVaultReady);
  }, []);

  const files = useMemo(
    () =>
      resolvedSharedPayloads
        .filter((p) => p.contentUri && p.contentType !== 'text' && p.contentType !== 'website')
        .map((p) => ({
          uri: p.contentUri!,
          name: p.originalName ?? `Shared ${new Date().toISOString().slice(0, 10)}`,
          mime: p.contentMimeType ?? p.mimeType ?? 'application/octet-stream',
          size: p.contentSize,
        })),
    [resolvedSharedPayloads],
  );
  const supported = files.filter((f) => SUPPORTED(f.mime));
  const skipped = resolvedSharedPayloads.length - supported.length;

  // Prefill once files are resolved (derived state, set during render).
  const [prefilledFor, setPrefilledFor] = useState('');
  const key = supported.map((f) => f.uri).join('|');
  if (key && key !== prefilledFor) {
    setPrefilledFor(key);
    setItems(supported.map((f) => ({ ...f, status: 'pending' })));
    const sugs = supported.map((f) => suggest(f.name));
    setNames(supported.map((f, i) => sugs[i].docType && /^(img|image|photo|scan|whatsapp|document|doc)[\s_-]?\w*/i.test(f.name) ? sugs[i].docType! : prettifyName(f.name)));
    setCategory(sugs[0]?.category ?? 'personal');
    setTags([...new Set(sugs.flatMap((s) => s.tags))]);
    const s0 = sugs[0];
    setForm({
      name: supported.length === 1 ? (s0.docType && /^(img|image|photo|scan|whatsapp|document|doc)/i.test(supported[0].name) ? s0.docType : prettifyName(supported[0].name)) : '',
      category: s0?.category ?? 'personal',
      docType: s0?.docType ?? null,
      expiry: s0?.expiry ? s0.expiry.split('-').reverse().join('/') : '',
      fields: s0?.number ? { number: s0.number } : {},
      notes: '',
      tags: s0?.tags ?? [],
    });
  }

  const single = supported.length === 1;
  const close = () => {
    clearSharedPayloads();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const save = async () => {
    setPhase('saving');
    const next = [...items];
    for (let i = 0; i < next.length; i++) {
      next[i] = { ...next[i], status: 'working' };
      setItems([...next]);
      try {
        const rec = await importDocument(
          { uri: next[i].uri, name: next[i].name, mime: next[i].mime },
          single && form
            ? { name: form.name, category: form.category, docType: form.docType, expiry: normalizeExpiry(form.expiry), fields: form.fields, notes: form.notes.trim() || null, tags: form.tags }
            : { name: names[i] || prettifyName(next[i].name), category, docType: suggest(next[i].name).docType, expiry: null, fields: {}, tags },
        );
        next[i] = { ...next[i], status: 'done', id: rec.id };
      } catch (e) {
        next[i] = { ...next[i], status: 'error', error: e instanceof Error ? e.message : String(e) };
      }
      setItems([...next]);
    }
    clearSharedPayloads();
    setTimeout(() => setPhase('done'), 450);
  };

  const ok = items.filter((i) => i.status === 'done');
  const failed = items.filter((i) => i.status === 'error');
  const canSave = single ? !!form && !!form.name.trim() && expiryValid(form.expiry) : names.every((n) => n.trim());

  // ----- blocking states -----
  let blocker: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action: string; go: () => void } | null = null;
  if (!accountLoading && vaultReady === false) {
    blocker = { icon: 'lock-closed', title: 'Set up DocVault first', body: 'Create your encrypted vault, then share the file again.', action: 'Set up vault', go: () => router.replace('/onboarding') };
  } else if (!isResolving && resolvedSharedPayloads.length > 0 && supported.length === 0) {
    blocker = { icon: 'document-outline', title: 'Nothing to add', body: 'DocVault can store PDFs and images. Text and links can’t be added.', action: 'Close', go: close };
  } else if (!isResolving && !error && resolvedSharedPayloads.length === 0 && vaultReady) {
    blocker = { icon: 'share-social-outline', title: 'No shared file', body: 'Share a PDF or photo from any app and choose DocVault.', action: 'Go to my vault', go: () => router.replace('/') };
  } else if (error) {
    blocker = { icon: 'alert-circle-outline', title: 'Couldn’t read the file', body: error.message, action: 'Close', go: close };
  }
  const loading = isResolving || vaultReady == null || accountLoading;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Gradient hero */}
      <LinearGradient
        colors={[c.accent, '#9A6BFF', c.bg]}
        locations={[0, 0.55, 1]}
        style={{ paddingTop: insets.top + space.sm, paddingBottom: space.xxxl + space.lg }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, height: 32, borderRadius: radius.pill }}>
            <Ionicons name="lock-closed" size={14} color="#fff" />
            <T v="caption" color="#fff" style={{ fontFamily: fonts.semibold }}>
              End-to-end encrypted
            </T>
          </View>
          {phase !== 'saving' && <IconButton icon="close" label="Close" onPress={close} bg="rgba(255,255,255,0.2)" tint="#fff" />}
        </View>
        <Animated.View entering={FadeInDown.duration(450)} style={{ paddingHorizontal: space.xl, marginTop: space.lg }}>
          <T v="title" color="#fff">
            {phase === 'done' ? 'All set' : 'Add to DocVault'}
          </T>
          <T v="callout" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
            {loading
              ? 'Reading shared file…'
              : supported.length
                ? `${supported.length} ${supported.length === 1 ? 'file' : 'files'} from another app${skipped > 0 ? ` · ${skipped} skipped` : ''}`
                : ' '}
          </T>
        </Animated.View>
        {supported.length > 0 && phase !== 'done' && (
          <View style={{ marginTop: space.xl }}>
            <FileStack files={supported} size={single ? 170 : 150} />
          </View>
        )}
      </LinearGradient>

      {/* Sheet */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, marginTop: -space.xxxl }}>
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          style={[{ flex: 1, backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }, elevation(c, 2)]}
        >
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={c.accent} size="large" />
            </View>
          ) : blocker ? (
            <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={blocker.icon} size={32} color={c.accent} />
              </View>
              <T v="heading" style={{ textAlign: 'center' }}>
                {blocker.title}
              </T>
              <T v="callout" color="muted" style={{ textAlign: 'center' }}>
                {blocker.body}
              </T>
              <Button title={blocker.action} onPress={blocker.go} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
            </Animated.View>
          ) : phase === 'form' ? (
            <>
              <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.xxl, gap: space.xl }} keyboardShouldPersistTaps="handled">
                {single && form ? (
                  <Animated.View entering={FadeInDown.delay(120).springify()}>
                    <FileChip f={items[0]} />
                    {form.docType && (
                      <Animated.View entering={FadeIn.delay(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md }}>
                        <Ionicons name="sparkles" size={15} color={c.accent} />
                        <T v="caption" color="accent" style={{ fontFamily: fonts.semibold }}>
                          Looks like a {form.docType}. We filled in what we could.
                        </T>
                      </Animated.View>
                    )}
                    <View style={{ marginTop: space.xl }}>
                      <DetailsForm value={form} onChange={setForm} />
                    </View>
                  </Animated.View>
                ) : (
                  <>
                    <Animated.View entering={FadeInDown.delay(80).springify()} style={{ gap: space.md }}>
                      <T v="heading">Names</T>
                      {items.map((f, i) => (
                        <Animated.View key={f.uri} entering={FadeInDown.delay(120 + i * 60).springify()}>
                          <Field
                            label={`${f.mime === 'application/pdf' ? 'PDF' : 'Image'}${f.size ? ` · ${formatBytes(f.size)}` : ''}`}
                            value={names[i]}
                            onChangeText={(v) => setNames(names.map((n, k) => (k === i ? v : n)))}
                          />
                        </Animated.View>
                      ))}
                    </Animated.View>
                    <Animated.View entering={FadeInDown.delay(200).springify()} style={{ gap: space.sm }}>
                      <T v="heading">Category for all</T>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                        {categories.map((cat) => (
                          <Chip key={cat.id} label={cat.name} icon={cat.icon as never} tint={cat.hue} active={category === cat.id} onPress={() => setCategory(cat.id)} />
                        ))}
                      </ScrollView>
                    </Animated.View>
                    <Animated.View entering={FadeInDown.delay(260).springify()}>
                      <TagInput value={tags} onChange={setTags} />
                    </Animated.View>
                  </>
                )}
              </ScrollView>
              <View style={{ padding: space.xl, paddingBottom: insets.bottom + space.lg }}>
                <Button title={single ? 'Encrypt & save' : `Encrypt & save ${items.length} files`} icon="shield-checkmark" onPress={save} disabled={!canSave} />
              </View>
            </>
          ) : phase === 'saving' ? (
            <View style={{ flex: 1, padding: space.xl, paddingTop: space.xxl, gap: space.md }}>
              <T v="heading">Encrypting on your device…</T>
              {items.map((f, i) => (
                <ProgressRow key={f.uri} f={f} name={single ? form?.name ?? f.name : names[i]} />
              ))}
            </View>
          ) : (
            <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.xxl, justifyContent: 'center' }}>
              <SaveSuccess
                title={failed.length ? `${ok.length} of ${items.length} saved` : ok.length === 1 ? 'Saved securely' : `${ok.length} documents saved`}
                subtitle={
                  failed.length
                    ? `${failed.length} couldn’t be added: ${failed[0].error}`
                    : `Encrypted and available offline${account?.mode === 'google' ? '. Backing up to Google Drive.' : '.'}`
                }
              />
              <View style={{ gap: space.md, marginTop: space.xxxl }}>
                {ok.length === 1 && <Button title="View document" icon="eye-outline" onPress={() => router.replace(`/doc/${ok[0].id}`)} />}
                <Button title={ok.length === 1 ? 'Done' : 'Open my vault'} variant={ok.length === 1 ? 'secondary' : 'primary'} onPress={() => router.replace('/(tabs)/documents')} />
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function FileChip({ f }: { f?: Item }) {
  const { c } = useTheme();
  if (!f) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md }, elevation(c, 1)]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={f.mime === 'application/pdf' ? 'document-text' : 'image'} size={22} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {f.name}
        </T>
        <T v="caption" color="muted">
          {f.mime === 'application/pdf' ? 'PDF' : 'Image'}
          {f.size ? ` · ${formatBytes(f.size)}` : ''}
        </T>
      </View>
    </View>
  );
}

function ProgressRow({ f, name }: { f: Item; name: string }) {
  const { c } = useTheme();
  const target = f.status === 'done' || f.status === 'error' ? 1 : f.status === 'working' ? 0.7 : 0;
  const dur = f.status === 'working' ? 900 : 300;
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: withTiming(target, { duration: dur }) }] }));
  const color = f.status === 'error' ? c.danger : f.status === 'done' ? c.success : c.accent;
  return (
    <Animated.View layout={LinearTransition} style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm }, elevation(c, 1)]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Ionicons name={f.mime === 'application/pdf' ? 'document-text' : 'image'} size={20} color={c.textMuted} />
        <T v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </T>
        {f.status === 'done' && (
          <Animated.View entering={FadeIn}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
          </Animated.View>
        )}
        {f.status === 'error' && <Ionicons name="alert-circle" size={22} color={c.danger} />}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
        <Animated.View style={[{ height: 6, width: '100%', borderRadius: 3, backgroundColor: color, transformOrigin: 'left' }, bar]} />
      </View>
    </Animated.View>
  );
}

