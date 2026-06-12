import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { gradients, paletteFor, ThemeColors, ThemeMode } from '../lib/theme';

const STORAGE_KEY = 'secureaiexam.theme';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  gradients: typeof gradients;
  isDark: boolean;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the new default; the user's last choice is restored async.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(() => {
    return {
      mode,
      colors: paletteFor(mode),
      gradients,
      isDark: mode === 'dark',
      toggle: () => setMode(mode === 'dark' ? 'light' : 'dark'),
      setMode,
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
