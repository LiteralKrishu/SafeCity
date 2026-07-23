import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { readSettings, writeSettings } from '@/db/repository';

export type AppearancePreference = 'system' | 'dark' | 'light';

interface ThemeValue {
  appearance: AppearancePreference;
  resolvedAppearance: 'dark' | 'light';
  setAppearance: (appearance: AppearancePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearancePreference>('system');

  useEffect(() => {
    let active = true;
    void readSettings(db).then((settings) => {
      if (!active) return;
      setAppearanceState(settings.appearance);
      Appearance.setColorScheme(settings.appearance === 'system' ? 'unspecified' : settings.appearance);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const setAppearance = useCallback(
    async (next: AppearancePreference) => {
      Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
      setAppearanceState(next);
      const settings = await readSettings(db);
      await writeSettings(db, { ...settings, appearance: next });
    },
    [db],
  );

  const value = useMemo<ThemeValue>(
    () => ({
      appearance,
      resolvedAppearance:
        appearance === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : appearance,
      setAppearance,
    }),
    [appearance, setAppearance, systemScheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
