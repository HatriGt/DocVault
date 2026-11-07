import { Platform } from 'react-native';

/**
 * "Graphite & Champagne" — warm ivory paper, graphite ink, one champagne accent.
 * Colour carries meaning only (valid / expiring / expired); everything else is
 * neutral so documents themselves are the colour in the UI.
 */
export const palette = {
  light: {
    bg: '#F5F2EC', // warm ivory paper
    surface: '#FFFFFF',
    surfaceAlt: '#EDE9E1', // pressed / inset
    border: 'rgba(21,23,27,0.08)',
    hairline: 'rgba(21,23,27,0.10)',
    text: '#15171B', // graphite ink
    textMuted: '#62645F',
    textFaint: '#9A9A93',
    accent: '#15171B', // primary actions are ink
    accentSoft: '#EAE4D8',
    onAccent: '#FFFFFF',
    gold: '#B08A5B', // champagne highlight
    goldSoft: '#F1E8DA',
    hero: '#16181C', // graphite hero surfaces (vault card, dock, stage)
    heroText: '#F3EFE7',
    heroMuted: 'rgba(243,239,231,0.62)',
    success: '#2F7D5B',
    successSoft: '#E3EFE8',
    warning: '#B7791F',
    warningSoft: '#F7ECD9',
    danger: '#C2413A',
    dangerSoft: '#F7E2DF',
    shadow: '#1B1A16',
    overlay: 'rgba(14,15,18,0.48)',
    blobA: '#EDE6D9',
    blobB: '#E8EEE9',
    blobC: '#F2E9DD',
  },
  dark: {
    bg: '#0D0E10',
    surface: '#17191D',
    surfaceAlt: '#202328',
    border: 'rgba(255,255,255,0.07)',
    hairline: 'rgba(255,255,255,0.09)',
    text: '#F3EFE7',
    textMuted: '#A3A29B',
    textFaint: '#6C6B66',
    accent: '#F3EFE7',
    accentSoft: '#2A2722',
    onAccent: '#0D0E10',
    gold: '#D3AE7C',
    goldSoft: '#2C251C',
    hero: '#1C1F24',
    heroText: '#F3EFE7',
    heroMuted: 'rgba(243,239,231,0.6)',
    success: '#5FB58C',
    successSoft: '#15251D',
    warning: '#E0A84E',
    warningSoft: '#2B2213',
    danger: '#EC7A6F',
    dangerSoft: '#33191A',
    shadow: '#000000',
    overlay: 'rgba(0,0,0,0.62)',
    blobA: '#1A1915',
    blobB: '#141917',
    blobC: '#1B1814',
  },
};

export type Colors = typeof palette.light;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_700Bold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
};

export const type = {
  // Editorial serif for large titles; Inter for everything functional.
  display: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -0.6 },
  title: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.2 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 15, letterSpacing: 1 },
};

export const elevation = (c: Colors, level: 1 | 2 | 3 = 1) => ({
  shadowColor: c.shadow,
  shadowOpacity: [0, 0.05, 0.09, 0.18][level],
  shadowRadius: [0, 12, 20, 32][level],
  shadowOffset: { width: 0, height: [0, 4, 10, 18][level] },
  elevation: [0, 1, 4, 10][level],
});
