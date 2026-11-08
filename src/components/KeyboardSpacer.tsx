import React, { useEffect, type RefObject } from 'react';
import { Keyboard, type ScrollView } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

/**
 * Reserves the keyboard's height below a screen's content. KeyboardAvoidingView doesn't
 * resize edge-to-edge Android screens, so buttons ended up under the keyboard.
 * Put it after the ScrollView; pass the ScrollView's ref to scroll to the end when the
 * keyboard opens, so the screen's primary button comes into view.
 */
export function KeyboardSpacer({ scrollRef }: { scrollRef?: RefObject<React.ComponentRef<typeof ScrollView> | null> }) {
  const keyboard = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({ height: keyboard.height.value }));
  useEffect(() => {
    if (!scrollRef) return;
    const sub = Keyboard.addListener('keyboardDidShow', () => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => sub.remove();
  }, [scrollRef]);
  return <Animated.View style={style} />;
}
