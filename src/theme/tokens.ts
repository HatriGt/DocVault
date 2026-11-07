import { Platform } from 'react-native';

export const palette = {
  light: {
    bg: '#F6F4FD', // soft lavender white
    surface: '#FFFFFF',
    surfaceAlt: '#F0EDFA',
    border: 'rgba(40,30,90,0.07)',
    text: '#14112B', // deep ink
    textMuted: '#5F5B76',
    textFaint: '#9A96B0',
    accent: '#6A4BFF', // vivid violet
    accentSoft: '#EEE9FF',
    onAccent: '#FFFFFF',
    success: '#16A36A',
    successSoft: '#E4F7EE',
    warning: '#D38412',
    warningSoft: '#FFF2DD',
    danger: '#F0456B',
    dangerSoft: '#FFE8EE',
    shadow: '#4B3BA8',
    overlay: 'rgba(20,17,43,0.45)',
    blobA: '#DCD3FF', // lavender
    blobB: '#FFE3BF', // peach
    blobC: '#FFF2B8', // butter
  },
  dark: {
    bg: '#0E0D17',
    surface: '#1A1828',
    surfaceAlt: '#242236',
    border: 'rgba(255,255,255,0.08)',
    text: '#F4F2FF',
    textMuted: '#ABA7C3',
    textFaint: '#6F6B88',
    accent: '#8F78FF',
    accentSoft: '#2A2550',
    onAccent: '#FFFFFF',
    success: '#3FCB8E',
    successSoft: '#13291F',
    warning: '#E9A94C',
    warningSoft: '#2F2414',
    danger: '#FF6D8C',
    dangerSoft: '#3A1822',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.6)',
    blobA: '#2B2459',
    blobB: '#3A2A1E',
    blobC: '#2E2A17',
  },
};

export type Colors = typeof palette.light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 12, md: 16, lg: 22, xl: 30, pill: 999 };

// Plus Jakarta Sans, one family per weight (Android ignores fontWeight with custom fonts).
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 15, letterSpacing: 1 },
};

export const elevation = (c: Colors, level: 1 | 2 | 3 = 1) => ({
  shadowColor: c.shadow,
  shadowOpacity: [0, 0.06, 0.1, 0.16][level],
  shadowRadius: [0, 10, 18, 28][level],
  shadowOffset: { width: 0, height: [0, 4, 8, 14][level] },
  elevation: [0, 2, 5, 10][level],
});
