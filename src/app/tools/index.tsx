import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { FadeInDown } from '../../theme/anim';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Tap } from '../../components/ui';
import { ScreenHeader } from '../../components/ScreenHeader';
import { elevation, radius, space, useTheme } from '../../theme';
import { TOOLS, ToolDef } from '../../lib/toolCatalog';
import { DUR, EASE_OUT } from '../../theme/motion';

/** Tools hub: image editing and PDF conversion, all on-device. */
export default function ToolsHub() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileW = (width - space.xl * 2 - space.md) / 2;
  const section = (title: string, list: ToolDef[], offset: number) => (
    <View style={{ marginTop: space.md }}>
      <T v="heading" style={{ paddingHorizontal: space.xl, marginBottom: space.md }}>
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl }}>
        {list.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.delay((offset + i) * 45).duration(DUR.slow).easing(EASE_OUT)}>
            <Tap
              onPress={() => router.push({ pathname: '/tools/run', params: { tool: t.id } })}
              accessibilityLabel={t.title}
              style={[{ width: tileW, minHeight: tileW * 0.9, borderRadius: radius.lg, backgroundColor: c.surface, padding: space.lg, justifyContent: 'space-between' }, elevation(c, 1)]}
            >
              <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: t.color + '18', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={t.icon} size={24} color={t.color} />
              </View>
              <View style={{ marginTop: space.md }}>
                <T v="bodyStrong">{t.title}</T>
                <T v="caption" color="muted" style={{ marginTop: 2 }}>
                  {t.subtitle}
                </T>
              </View>
            </Tap>
          </Animated.View>
        ))}
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Tools" subtitle="Edit, convert and combine documents, privately on your phone." />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        {section('Images', TOOLS.filter((t) => t.accepts === 'image'), 0)}
        {section('PDF', TOOLS.filter((t) => t.accepts === 'pdf'), 4)}
      </ScrollView>
    </View>
  );
}
