import { Platform } from 'react-native';

/**
 * Violet — one refined brand colour on calm neutrals, with soft pastel
 * background washes. Status colours appear only where they carry meaning.
 */
export const palette = {
  light: {
    bg: '#F6F5FA', // near-white with a hint of lavender
    surface: '#FFFFFF',
    surfaceAlt: '#EFEDF6',
    border: 'rgba(28,22,64,0.07)',
    hairline: 'rgba(28,22,64,0.09)',
    text: '#16132D',
    textMuted: '#57536E', // darker than before for outdoor legibility
    textFaint: '#8E8AA5',
    accent: '#5B45F2', // brand violet (deeper, less neon)
    accentSoft: '#ECE9FE',
    onAccent: '#FFFFFF',
    gold: '#5B45F2', // highlight colour = brand
    goldSoft: '#ECE9FE',
    hero: '#3A2BB8', // deep indigo for hero surfaces (vault card, stage)
    heroText: '#FFFFFF',
    heroMuted: 'rgba(255,255,255,0.72)',
    success: '#15A06A',
    successSoft: '#E3F6EC',
    warning: '#D08316',
    warningSoft: '#FFF1DA',
    danger: '#E5484D',
    dangerSoft: '#FDE8E9',
    shadow: '#3B2DA0',
    overlay: 'rgba(22,19,45,0.45)',
    blobA: '#DED6FF', // lavender
    blobB: '#FFE4C4', // peach
    blobC: '#FFF3BF', // butter
  },
  dark: {
    bg: '#0F0D1A',
    surface: '#1A1729',
    surfaceAlt: '#242138',
    border: 'rgba(255,255,255,0.07)',
    hairline: 'rgba(255,255,255,0.09)',
    text: '#F4F2FF',
    textMuted: '#ACA8C6',
    textFaint: '#716D8C',
    accent: '#8E7BFF',
    accentSoft: '#2A2550',
    onAccent: '#FFFFFF',
    gold: '#8E7BFF',
    goldSoft: '#2A2550',
    hero: '#2D2378',
    heroText: '#FFFFFF',
    heroMuted: 'rgba(255,255,255,0.7)',
    success: '#3FCB8E',
    successSoft: '#13291F',
    warning: '#E9A94C',
    warningSoft: '#2F2414',
    danger: '#FF6B70',
    dangerSoft: '#3A1820',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.6)',
    blobA: '#2A2459',
    blobB: '#37291D',
    blobC: '#2D2916',
  },
};

export type Colors = typeof palette.light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

// Plus Jakarta Sans, one family per weight (Android ignores fontWeight with custom fonts).
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  // Display roles (previously serif) map to the same family for one consistent voice.
  serif: 'PlusJakartaSans_800ExtraBold',
  serifItalic: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.1 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 15, letterSpacing: 1 },
};

export const elevation = (c: Colors, level: 1 | 2 | 3 = 1) => ({
  shadowColor: c.shadow,
  shadowOpacity: [0, 0.06, 0.1, 0.18][level],
  shadowRadius: [0, 12, 20, 32][level],
  shadowOffset: { width: 0, height: [0, 4, 10, 18][level] },
  elevation: [0, 1, 4, 10][level],
});
