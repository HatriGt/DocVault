import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, T } from '../../components/ui';
import { space } from '../../theme';
import { useDocument } from '../../lib/hooks';
import { materialize } from '../../lib/documents';
import { purgeTempPlain } from '../../lib/blobs';
import { shareDoc } from '../../lib/actions';

/** Full-screen image viewer with pinch-to-zoom, pan and double-tap. */
export default function Viewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { doc } = useDocument(id);
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    materialize(doc)
      .then((f) => alive && setUri(f.uri))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      purgeTempPlain();
    };
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(saved.value * e.scale, 6));
    })
    .onEnd(() => {
      saved.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = sx.value + e.translationX;
        ty.value = sy.value + e.translationY;
      }
    })
    .onEnd(() => {
      sx.value = tx.value;
      sy.value = ty.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withSpring(next);
      saved.value = next;
      if (next === 1) {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        sx.value = 0;
        sy.value = 0;
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      {uri ? (
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[{ flex: 1 }, style]}>
            <Image source={{ uri }} style={{ flex: 1 }} contentFit="contain" cachePolicy="none" />
          </Animated.View>
        </GestureDetector>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl }}>
          {error ? (
            <T v="body" color="#fff" style={{ textAlign: 'center' }}>
              {error}
            </T>
          ) : (
            <ActivityIndicator color="#fff" />
          )}
        </View>
      )}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.xl, right: space.xl, flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} bg="rgba(255,255,255,0.15)" tint="#fff" />
        {doc && <IconButton icon="share-outline" label="Share" onPress={() => shareDoc(doc)} bg="rgba(255,255,255,0.15)" tint="#fff" />}
      </View>
    </View>
  );
}
