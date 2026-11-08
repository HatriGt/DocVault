import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, IconButton, Screen, T, Tap } from '../components/ui';
import { DetailsForm, expiryValid, FormState, normalizeExpiry } from '../components/DetailsForm';
import { radius, space, useTheme } from '../theme';
import { SaveSuccess } from '../components/SaveSuccess';
import { findDuplicate, importDocument, ImportSource, MAX_FILE_BYTES } from '../lib/documents';
import { discardScan, ScanPage, scanPages } from '../lib/scan';
import { ScanReview } from '../components/ScanReview';
import { File } from 'expo-file-system';
import { prettifyName, suggest } from '../lib/classify';
import { recognizeText, ocrAvailable } from '../lib/ocr';
import { useAccount } from '../lib/hooks';
import { formatBytes } from '../lib/format';

type Step = 'source' | 'scan' | 'details' | 'confirm' | 'saving' | 'done';
type Source = 'camera' | 'photos' | 'files';

export default function AddDocument() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ folder?: string }>();
  const { account } = useAccount();
  const [step, setStep] = useState<Step>('source');
  const [src, setSrc] = useState<(ImportSource & { size?: number }) | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', category: 'identity', docType: null, expiry: '', fields: {}, notes: '', tags: [], folderId: params.folder ?? null });
  const [newId, setNewId] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScanPage[]>([]);

  const accept = async (s: ImportSource & { size?: number }) => {
    setSrc(s);
    const text = s.mime.startsWith('image/') ? await recognizeText(s.uri) : '';
    const sug = suggest(s.name, text);
    setForm({
      name: sug.docType && /^(scan|img|image|photo|document)[\s_-]?\d*/i.test(s.name) ? sug.docType : prettifyName(s.name),
      category: sug.category,
      docType: sug.docType,
      expiry: sug.expiry ? sug.expiry.split('-').reverse().join('/') : '',
      fields: sug.number ? { number: sug.number } : {},
      notes: '',
      tags: sug.tags,
      folderId: params.folder ?? null,
    });
    setStep('details');
  };

  const pick = async (kind: Source) => {
    try {
      if (kind === 'camera') {
        // Prefer the system document scanner (edge detection), then review pages.
        try {
          const pages = await scanPages();
          if (pages) {
            setScanned(pages);
            setStep('scan');
          }
          return;
        } catch {
          // Scanner unavailable (e.g. no Google Play services) → plain camera.
        }
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera access needed', 'Allow camera access in Settings to scan documents.');
          return;
        }
        const r = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true, exif: false });
        if (r.canceled) return;
        const a = r.assets[0];
        accept({ uri: a.uri, name: `Scan ${new Date().toISOString().slice(0, 10)}.jpg`, mime: a.mimeType ?? 'image/jpeg', size: a.fileSize });
      } else if (kind === 'photos') {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false });
        if (r.canceled) return;
        const a = r.assets[0];
        accept({ uri: a.uri, name: a.fileName ?? 'Photo.jpg', mime: a.mimeType ?? 'image/jpeg', size: a.fileSize });
      } else {
        // System picker: includes local storage, iCloud Drive and Google Drive providers.
        const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (r.canceled) return;
        const a = r.assets[0];
        accept({ uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream', size: a.size });
      }
    } catch (e) {
      Alert.alert('Couldn’t import', e instanceof Error ? e.message : String(e));
    }
  };


  const save = async () => {
    if (!src) return;
    const size = new File(src.uri).size ?? 0;
    if (size > MAX_FILE_BYTES) {
      Alert.alert('File too large', 'DocVault can store files up to 200 MB on this phone.');
      return;
    }
    const bytes = await new File(src.uri).bytes(); // read once: used for duplicate check and saving
    const dup = await findDuplicate(bytes).catch(() => null);
    if (dup) {
      const choice = await new Promise<'view' | 'save' | 'cancel'>((resolve) =>
        Alert.alert('Already in your vault', `This file is identical to “${dup.name}”.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
          { text: 'View existing', onPress: () => resolve('view') },
          { text: 'Save anyway', onPress: () => resolve('save') },
        ]),
      );
      if (choice === 'view') return router.replace(`/doc/${dup.id}`);
      if (choice === 'cancel') return;
    }
    setStep('saving');
    try {
      const rec = await importDocument(src, {
        name: form.name,
        category: form.category,
        docType: form.docType,
        expiry: normalizeExpiry(form.expiry),
        fields: form.fields,
        notes: form.notes.trim() || null,
        tags: form.tags,
        folderId: form.folderId ?? null,
      }, bytes);
      if (src.uri.includes('/scans/')) discardScan(src.uri); // remove the scanner's plaintext output
      setNewId(rec.id);
      setStep('done');
    } catch (e) {
      Alert.alert('Couldn’t save document', e instanceof Error ? e.message : String(e));
      setStep('confirm');
    }
  };

  const title = { source: 'Add document', scan: 'Review scan', details: 'Details', confirm: 'Review', saving: '', done: '' }[step];
  const cloud = account?.mode === 'google';

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, height: 56 }}>
        {step === 'details' || step === 'confirm' ? (
          <IconButton icon="chevron-back" label="Back" onPress={() => setStep(step === 'confirm' ? 'details' : 'source')} />
        ) : (
          <View style={{ width: 44 }} />
        )}
        <T v="bodyStrong">{title}</T>
        {step !== 'saving' ? <IconButton icon="close" label="Close" onPress={() => router.back()} /> : <View style={{ width: 44 }} />}
      </View>

      {step === 'scan' && (
        <ScanReview
          initial={scanned}
          onCancel={() => setStep('source')}
          onDone={(r) => accept({ uri: r.uri, name: r.name, mime: r.mime })}
        />
      )}

      {step === 'source' && (
        <Animated.View entering={FadeIn} style={{ padding: space.xl, gap: space.md }}>
          <T v="title" style={{ marginBottom: space.md }}>
            How would you like{'\n'}to add it?
          </T>
          <SourceOption icon="scan" title="Smart scan" body="Camera finds the edges · review pages · save as PDF" onPress={() => pick('camera')} />
          <SourceOption icon="images-outline" title="Photos" body="A picture you already took of a document" onPress={() => pick('photos')} />
          <SourceOption icon="folder-open-outline" title="Browse files" body="Phone storage, Downloads, Google Drive · any file type" onPress={() => pick('files')} />
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
            <Ionicons name="lock-closed" size={15} color={c.textMuted} />
            <T v="caption" color="muted" style={{ flex: 1 }}>
              Files are encrypted on this device before anything is stored or uploaded.
            </T>
          </View>
        </Animated.View>
      )}

      {step === 'details' && src && (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
            <SourcePreview src={src} />
            {!ocrAvailable() && form.docType && (
              <T v="caption" color="accent" style={{ marginTop: space.md }}>
                ✦ Suggested: {form.docType}
              </T>
            )}
            <View style={{ marginTop: space.xl }}>
              <DetailsForm value={form} onChange={setForm} />
            </View>
          </ScrollView>
          <View style={{ padding: space.xl, paddingTop: space.sm }}>
            <Button title="Continue" onPress={() => setStep('confirm')} disabled={!form.name.trim() || !expiryValid(form.expiry)} />
          </View>
        </KeyboardAvoidingView>
      )}

      {step === 'confirm' && src && (
        <Animated.View entering={FadeIn} style={{ flex: 1, padding: space.xl }}>
          <SourcePreview src={src} />
          <View style={{ marginTop: space.xl, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
            <Line k="Name" v={form.name} />
            <Line k="Type" v={form.docType ?? '—'} />
            <Line k="Expiry" v={normalizeExpiry(form.expiry) ?? 'Not set'} />
            {form.tags.length > 0 && <Line k="Tags" v={form.tags.map((t) => `#${t}`).join('  ')} />}
          </View>
          <View style={{ marginTop: space.xl, gap: space.lg }}>
            <PlanStep icon="lock-closed" text="Encrypt with AES-256-GCM on this device" />
            <PlanStep icon="phone-portrait-outline" text="Keep an encrypted copy for offline access" />
            <PlanStep icon={cloud ? 'cloud-upload-outline' : 'cloud-offline-outline'} text={cloud ? 'Back up the encrypted file to your Google Drive' : 'Stored on this device only (connect Drive in Settings)'} />
          </View>
          <View style={{ flex: 1 }} />
          <Button title="Encrypt & save" icon="shield-checkmark" onPress={save} />
        </Animated.View>
      )}

      {step === 'saving' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
          <ActivityIndicator size="large" color={c.accent} />
          <T v="bodyStrong">Encrypting…</T>
        </View>
      )}

      {step === 'done' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg }}>
          <SaveSuccess title="Saved securely" subtitle={`${form.name} is encrypted and available offline.${cloud ? ' It’ll back up to Drive automatically.' : ''}`} />
          <View style={{ alignSelf: 'stretch', gap: space.md, marginTop: space.xl }}>
            <Button title="View document" onPress={() => router.replace(`/doc/${newId}`)} />
            <Button
              title="Add another"
              variant="secondary"
              onPress={() => {
                setSrc(null);
                setStep('source');
              }}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

function SourceOption({ icon, title, body, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Tap onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg }}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={23} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        <T v="caption" color="muted">
          {body}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
    </Tap>
  );
}

function SourcePreview({ src }: { src: ImportSource & { size?: number } }) {
  const { c } = useTheme();
  const image = src.mime.startsWith('image/');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md }}>
      {image ? (
        <Image source={{ uri: src.uri }} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
      ) : (
        <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="document-text" size={28} color={c.accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={1}>
          {src.name}
        </T>
        <T v="caption" color="muted">
          {image ? 'Image' : src.mime === 'application/pdf' ? 'PDF' : (src.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? 'File').toUpperCase()}
          {src.size ? ` · ${formatBytes(src.size)}` : ''}
        </T>
      </View>
    </View>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <T v="callout" color="muted">
        {k}
      </T>
      <T v="callout" numberOfLines={1} style={{ flexShrink: 1 }}>
        {v}
      </T>
    </View>
  );
}

function PlanStep({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={c.accent} />
      </View>
      <T v="callout" style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}
