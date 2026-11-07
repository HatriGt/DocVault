import { Platform } from 'react-native';

export const palette = {
  light: {
    bg: '#F7F5F1', // warm off-white
    surface: '#FFFFFF',
    surfaceAlt: '#EFECE6',
    border: 'rgba(23,22,26,0.08)',
    text: '#17161A', // deep charcoal
    textMuted: '#6B6870',
    textFaint: '#9C99A1',
    accent: '#5B4CF0', // electric indigo — the only brand colour
    accentSoft: '#ECEAFE',
    onAccent: '#FFFFFF',
    success: '#1F9D6B',
    successSoft: '#E3F5EC',
    warning: '#C27A12',
    warningSoft: '#FBF0DC',
    danger: '#D6455D',
    dangerSoft: '#FCE8EC',
    shadow: '#2A2440',
    overlay: 'rgba(15,14,20,0.45)',
  },
  dark: {
    bg: '#0F0F12',
    surface: '#1A1A1F',
    surfaceAlt: '#24242B',
    border: 'rgba(255,255,255,0.08)',
    text: '#F3F2EF',
    textMuted: '#A3A1A8',
    textFaint: '#6E6C74',
    accent: '#8C82FF',
    accentSoft: '#25223F',
    onAccent: '#0F0F12',
    success: '#43C08D',
    successSoft: '#12291F',
    warning: '#E2A54A',
    warningSoft: '#2E2414',
    danger: '#F0687E',
    dangerSoft: '#341A20',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.6)',
  },
};

export type Colors = typeof palette.light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

const family = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const familyMedium = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

export const type = {
  display: { fontFamily: family, fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontFamily: family, fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontFamily: familyMedium, fontSize: 19, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontFamily: family, fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontFamily: familyMedium, fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  callout: { fontFamily: family, fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  caption: { fontFamily: familyMedium, fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.1 },
  overline: { fontFamily: familyMedium, fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 1.2 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 15, letterSpacing: 1 },
};

export const elevation = (c: Colors, level: 1 | 2 | 3 = 1) => ({
  shadowColor: c.shadow,
  shadowOpacity: [0, 0.06, 0.1, 0.16][level],
  shadowRadius: [0, 10, 18, 28][level],
  shadowOffset: { width: 0, height: [0, 4, 8, 14][level] },
  elevation: [0, 2, 5, 10][level],
});
