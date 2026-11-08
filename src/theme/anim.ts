/**
 * Layout animations used across the app, pinned to always run.
 *
 * With Android "Remove animations" (or iOS Reduce Motion) on, Reanimated's default
 * ReduceMotion.System is meant to skip to the final frame, but entering animations
 * were left at their first frame instead — opacity 0 — so whole screens rendered
 * blank. These are short fades/slides, so we always play them through.
 *
 * Import animation builders from here, not from 'react-native-reanimated'.
 */
import * as R from 'react-native-reanimated';

const N = R.ReduceMotion.Never;

export const FadeIn = R.FadeIn.reduceMotion(N);
export const FadeInDown = R.FadeInDown.reduceMotion(N);
export const FadeInUp = R.FadeInUp.reduceMotion(N);
export const FadeInRight = R.FadeInRight.reduceMotion(N);
export const FadeOut = R.FadeOut.reduceMotion(N);
export const FadeOutDown = R.FadeOutDown.reduceMotion(N);
export const FadeOutLeft = R.FadeOutLeft.reduceMotion(N);
export const SlideInDown = R.SlideInDown.reduceMotion(N);
export const SlideOutDown = R.SlideOutDown.reduceMotion(N);
export const ZoomIn = R.ZoomIn.reduceMotion(N);
export const LinearTransition = R.LinearTransition.reduceMotion(N);
