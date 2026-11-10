import { Easing } from 'react-native-reanimated';

/**
 * One motion language for the whole app: fast start, long gentle settle,
 * no overshoot/bounce. Durations are short so UI feels responsive.
 */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1); // easeOutQuint
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const DUR = { fast: 180, base: 260, slow: 360 };
