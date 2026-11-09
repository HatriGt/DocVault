import React, { useEffect, type RefObject } from 'react';
import { Keyboard, type ScrollView } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScrollRef = RefObject<React.ComponentRef<typeof ScrollView> | null>;

/**
 * Reserves the keyboard's height below a screen's content. KeyboardAvoidingView doesn't
 * resize edge-to-edge Android screens, so buttons ended up under the keyboard.
 *
 * Put it after the ScrollView and pass the ScrollView's ref: the content scrolls to the end
 * (where the primary button lives) when the keyboard opens, and whenever `revealKey` changes
 * while it's open — e.g. a new wizard step mounts with the keyboard already up.
 */
export function KeyboardSpacer({ scrollRef, revealKey }: { scrollRef?: ScrollRef; revealKey?: unknown }) {
  const keyboard = useAnimatedKeyboard();
  // The reported keyboard height includes the navigation bar, which the screen already keeps clear of.
  const bottomInset = useSafeAreaInsets().bottom;
  const style = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.height.value - bottomInset) }));

  useEffect(() => {
    if (!scrollRef) return;
    const reveal = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    const subs = [Keyboard.addListener('keyboardDidShow', reveal), Keyboard.addListener('keyboardDidChangeFrame', reveal)];
    return () => subs.forEach((s) => s.remove());
  }, [scrollRef]);

  useEffect(() => {
    if (!scrollRef || !Keyboard.isVisible()) return;
    // Wait a frame for the new content to lay out before scrolling.
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [revealKey, scrollRef]);

  return <Animated.View style={style} />;
}
