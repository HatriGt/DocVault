import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, EmptyState, Field, IconButton, T, Tap } from '../../components/ui';
import { DocThumb } from '../../components/docs';
import { SaveSuccess } from '../../components/SaveSuccess';
import { elevation, fonts, radius, space, useTheme } from '../../theme';
import { useDocuments } from '../../lib/hooks';
import { isImage, isPdf } from '../../lib/documents';
import { formatBytes } from '../../lib/format';
import { toolById } from '../../lib/toolCatalog';
import { extractPages, imagesToPdf, mergePdfs, parsePageRanges, pdfPageCount, rotatePdf, splitPdf } from '../../lib/tools';
import type { DocRecord } from '../../lib/db';
import { DUR, EASE_OUT } from '../../theme/motion';

type Step = 'pick' | 'options' | 'running' | 'done';

export default function RunTool() {
  const params = useLocalSearchParams<{ tool: string; ids?: string }>();
  const tool = toolById(params.tool);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { docs } = useDocuments();
  const [selected, setSelected] = useState<string[]>(params.ids ? params.ids.split(',') : []);
  const minCount = tool?.id === 'img2pdf' ? 1 : tool?.multi ? 2 : 1;
  const [step, setStep] = useState<Step>(params.ids && tool && params.ids.split(',').length >= minCount ? 'options' : 'pick');
  const [name, setName] = useState(params.tool === 'img2pdf' ? 'Scans (PDF)' : params.tool === 'merge' ? 'Merged document' : 'Extracted pages');
  const [page, setPage] = useState<'fit' | 'a4'>('a4');
  const [ranges, setRanges] = useState('');
  const [pages, setPages] = useState<number | null>(null);
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [resultIds, setResultIds] = useState<string[]>([]);

  const eligible = useMemo(() => docs.filter((d) => (tool?.accepts === 'pdf' ? isPdf(d) : isImage(d))), [docs, tool]);
  const chosen = selected.map((id) => docs.find((d) => d.id === id)).filter(Boolean) as DocRecord[];

  if (!tool) return <EmptyState icon="construct-outline" title="Unknown tool" body="" action="Back" onAction={() => router.back()} />;

  // Single-image tools are handled by the editor.
  const goEditor = (id: string) => router.replace({ pathname: '/edit-image/[id]', params: { id } });

  const toggle = (d: DocRecord) => {
    if (!tool.multi) {
      if (tool.accepts === 'image') return goEditor(d.id);
      setSelected([d.id]);
      return;
    }
    setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]));
  };
  const move = (i: number, dir: -1 | 1) =>
    setSelected((s) => {
      const n = [...s];
      const j = i + dir;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const toOptions = async () => {
    setStep('options');
    const first = chosen[0];
    setName(tool.id === 'img2pdf' ? `${first?.name ?? 'Scans'} (PDF)` : tool.id === 'merge' ? `${first?.name ?? 'Merged'} + ${chosen.length - 1}` : `${first?.name ?? 'Document'} (pages)`);
    if (tool.accepts === 'pdf' && first && !tool.multi) {
      try {
        setPages(await pdfPageCount(first));
      } catch {
        setPages(null);
      }
    }
  };

  const run = async () => {
    setStep('running');
    try {
      let ids: string[] = [];
      if (tool.id === 'img2pdf') ids = [await imagesToPdf(chosen, { page, margin: page === 'a4' ? 24 : 0 }, name)];
      else if (tool.id === 'merge') ids = [await mergePdfs(chosen, name)];
      else if (tool.id === 'split') ids = await splitPdf(chosen[0]);
      else if (tool.id === 'extract') {
        const idx = parsePageRanges(ranges, pages ?? 9999);
        if (!idx.length) throw new Error('Enter pages to extract, e.g. 1-3, 5');
        ids = [await extractPages(chosen[0], idx, name)];
      } else if (tool.id === 'rotate') ids = [await rotatePdf(chosen[0], rotation, 'new')];
      setResultIds(ids);
      setStep('done');
    } catch (e) {
      setStep('options');
      Alert.alert('Couldn’t finish', e instanceof Error ? e.message : String(e));
    }
  };

  const canContinue = tool.multi ? chosen.length >= minCount : chosen.length === 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.sm }}>
        <IconButton icon={step === 'options' && !params.ids ? 'chevron-back' : 'close'} label="Back" onPress={() => (step === 'options' && !params.ids ? setStep('pick') : router.back())} />
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: tool.color + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={tool.icon} size={21} color={tool.color} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyStrong">{tool.title}</T>
          <T v="caption" color="muted">
            {step === 'pick' ? (tool.multi ? 'Select two or more, in order' : `Choose a ${tool.accepts === 'pdf' ? 'PDF' : 'photo'}`) : tool.subtitle}
          </T>
        </View>
      </View>

      {step === 'pick' && (
        <>
          <FlatList
            data={eligible}
            keyExtractor={(d) => d.id}
            contentContainerStyle={{ padding: space.xl, gap: space.sm, paddingBottom: 140 }}
            ListEmptyComponent={<EmptyState icon="document-outline" title={`No ${tool.accepts === 'pdf' ? 'PDFs' : 'images'} yet`} body="Add one to your vault first." />}
            renderItem={({ item, index }) => {
              const order = selected.indexOf(item.id);
              const on = order >= 0;
              return (
                <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                  <Tap onPress={() => toggle(item)} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 2, borderColor: on ? c.accent : 'transparent' }, elevation(c, 1)]}>
                    <DocThumb doc={item} size={48} />
                    <View style={{ flex: 1 }}>
                      <T v="bodyStrong" numberOfLines={1}>
                        {item.name}
                      </T>
                      <T v="caption" color="muted">
                        {formatBytes(item.size)}
                      </T>
                    </View>
                    {tool.multi ? (
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: on ? c.accent : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        {on && (
                          <T v="caption" color="onAccent" style={{ fontFamily: fonts.bold }}>
                            {order + 1}
                          </T>
                        )}
                      </View>
                    ) : (
                      <Ionicons name={on ? 'radio-button-on' : 'chevron-forward'} size={22} color={on ? c.accent : c.textFaint} />
                    )}
                  </Tap>
                </Animated.View>
              );
            }}
          />
          {tool.accepts === 'pdf' || tool.multi ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, paddingBottom: insets.bottom + space.lg, backgroundColor: c.bg }}>
              <Button title={tool.multi ? `Continue with ${chosen.length}` : 'Continue'} onPress={toOptions} disabled={!canContinue} />
            </View>
          ) : null}
        </>
      )}

      {step === 'options' && (
        <>
          <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
            {tool.multi && (
              <View style={{ gap: space.sm }}>
                <T v="heading">Order</T>
                {chosen.map((d, i) => (
                  <Animated.View key={d.id} layout={LinearTransition.duration(DUR.base).easing(EASE_OUT)} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.surface, borderRadius: radius.md, padding: space.sm }, elevation(c, 1)]}>
                    <T v="bodyStrong" color="accent" style={{ width: 22, textAlign: 'center' }}>
                      {i + 1}
                    </T>
                    <DocThumb doc={d} size={40} />
                    <T v="body" style={{ flex: 1 }} numberOfLines={1}>
                      {d.name}
                    </T>
                    <IconButton icon="arrow-up" label="Move up" size={36} onPress={() => move(i, -1)} />
                    <IconButton icon="arrow-down" label="Move down" size={36} onPress={() => move(i, 1)} />
                  </Animated.View>
                ))}
              </View>
            )}
            {tool.id !== 'split' && tool.id !== 'rotate' && <Field label="New document name" value={name} onChangeText={setName} />}
            {tool.id === 'img2pdf' && (
              <View style={{ gap: space.sm }}>
                <T v="caption" color="muted">
                  Page size
                </T>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Chip label="A4 pages" icon="document-outline" active={page === 'a4'} onPress={() => setPage('a4')} />
                  <Chip label="Fit to image" icon="scan-outline" active={page === 'fit'} onPress={() => setPage('fit')} />
                </View>
              </View>
            )}
            {tool.id === 'extract' && (
              <Field label={`Pages to extract${pages ? ` (1–${pages})` : ''}`} value={ranges} onChangeText={setRanges} placeholder="e.g. 1-3, 5" keyboardType="numbers-and-punctuation" />
            )}
            {tool.id === 'split' && (
              <T v="body" color="muted">
                {pages ? `This creates ${pages} new documents, one per page.` : 'Each page becomes its own document.'} The original stays untouched.
              </T>
            )}
            {tool.id === 'rotate' && (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                {([90, 180, 270] as const).map((r) => (
                  <Chip key={r} label={r === 270 ? '90° left' : r === 90 ? '90° right' : '180°'} active={rotation === r} onPress={() => setRotation(r)} />
                ))}
              </View>
            )}
          </ScrollView>
          <View style={{ padding: space.xl, paddingBottom: insets.bottom + space.lg }}>
            <Button title={tool.id === 'split' ? 'Split PDF' : 'Create'} icon="sparkles" onPress={run} disabled={!chosen.length} />
          </View>
        </>
      )}

      {step === 'running' && (
        <Animated.View entering={FadeIn} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
          <ActivityIndicator size="large" color={tool.color} />
          <T v="bodyStrong">Working on it…</T>
          <T v="caption" color="muted">
            Processing and encrypting on your device
          </T>
        </Animated.View>
      )}

      {step === 'done' && (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.xxl }}>
          <SaveSuccess title={resultIds.length > 1 ? `${resultIds.length} documents created` : 'Done!'} subtitle="Saved to your vault, encrypted and available offline." />
          <View style={{ gap: space.md, marginTop: space.xxxl }}>
            {resultIds.length === 1 && <Button title="View document" icon="eye-outline" onPress={() => router.replace(`/doc/${resultIds[0]}`)} />}
            <Button title="Back to tools" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}
