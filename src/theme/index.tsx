import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palette, Colors } from './tokens';
import { usePrefs } from '../lib/hooks';

interface Theme {
  c: Colors;
  dark: boolean;
}
const Ctx = createContext<Theme>({ c: palette.light, dark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const prefs = usePrefs();
  const dark = prefs.theme === 'system' ? system === 'dark' : prefs.theme === 'dark';
  const value = useMemo(() => ({ c: dark ? palette.dark : palette.light, dark }), [dark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
export * from './tokens';
