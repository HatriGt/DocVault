import React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T, Tap } from '../../components/ui';
import { elevation, radius, space, useTheme } from '../../theme';
import { TOOLS, ToolDef } from '../../lib/toolCatalog';

/** Tools hub: image editing and PDF conversion, all on-device. */
export default function ToolsHub() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileW = (width - space.xl * 2 - space.md) / 2;
  const section = (title: string, list: ToolDef[], offset: number) => (
    <View style={{ marginTop: space.xl }}>
      <T v="heading" style={{ paddingHorizontal: space.xl, marginBottom: space.md }}>
        {title}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl }}>
        {list.map((t, i) => (
          <Animated.View key={t.id} entering={FadeInDown.delay((offset + i) * 45).springify().damping(16)}>
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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        <LinearGradient colors={['#2A2D33', '#16181C', c.bg]} locations={[0, 0.6, 1]} style={{ paddingTop: insets.top + space.sm, paddingBottom: space.xxl, paddingHorizontal: space.xl }}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} bg="rgba(255,255,255,0.2)" tint="#fff" />
          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: space.lg }}>
            <T v="title" color="#fff">
              Tools
            </T>
            <T v="callout" color="rgba(255,255,255,0.88)" style={{ marginTop: 4 }}>
              Edit, convert and combine documents, privately on your phone.
            </T>
          </Animated.View>
        </LinearGradient>
        {section('Images', TOOLS.filter((t) => t.accepts === 'image'), 0)}
        {section('PDF', TOOLS.filter((t) => t.accepts === 'pdf'), 4)}
      </ScrollView>
    </View>
  );
}
