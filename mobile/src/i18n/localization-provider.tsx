import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { readSettings, writeSettings } from '@/db/repository';
import {
  prepareTranslationPack,
  type TranslationPack,
} from '@/i18n/machine-translation';
import {
  readStoredLanguagePreference,
  writeStoredLanguagePreference,
} from '@/i18n/language-storage';
import { englishTranslations, translations, type TranslationKey } from '@/i18n/translations';
import {
  detectDeviceLanguage,
  isBundledLanguage,
  normalizeLanguagePreference,
  type LanguagePreference,
  type SupportedLanguage,
} from '@/i18n/types';

type TranslationParams = Record<string, string | number>;

interface LocalizationValue {
  language: SupportedLanguage;
  languageTag: string;
  preference: LanguagePreference;
  preparingLanguage: SupportedLanguage | null;
  setLanguagePreference: (preference: LanguagePreference) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const LocalizationContext = createContext<LocalizationValue | null>(null);

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/gu, (match, key: string) =>
    params[key] === undefined ? match : String(params[key]),
  );
}

export function LocalizationProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [preference, setPreference] = useState<LanguagePreference>('system');
  const [deviceLanguage, setDeviceLanguage] = useState<SupportedLanguage>(detectDeviceLanguage);
  const [dynamicPacks, setDynamicPacks] = useState<Partial<Record<SupportedLanguage, TranslationPack>>>({});
  const [preparingLanguage, setPreparingLanguage] = useState<SupportedLanguage | null>(null);
  const packsRef = useRef<Partial<Record<SupportedLanguage, TranslationPack>>>({});
  const inFlightRef = useRef(new Map<SupportedLanguage, Promise<TranslationPack>>());

  const ensureLanguage = useCallback(
    async (language: SupportedLanguage): Promise<TranslationPack> => {
      if (isBundledLanguage(language)) return translations[language];
      const loaded = packsRef.current[language];
      if (loaded) return loaded;
      const inFlight = inFlightRef.current.get(language);
      if (inFlight) return inFlight;

      setPreparingLanguage(language);
      const promise = prepareTranslationPack(db, language)
        .then((pack) => {
          packsRef.current = { ...packsRef.current, [language]: pack };
          setDynamicPacks(packsRef.current);
          return pack;
        })
        .finally(() => {
          inFlightRef.current.delete(language);
          setPreparingLanguage((current) => (current === language ? null : current));
        });
      inFlightRef.current.set(language, promise);
      return promise;
    },
    [db],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      readStoredLanguagePreference().catch(() => null),
      readSettings(db).catch(() => null),
    ]).then(([storedPreference, settings]) => {
      if (!active) return;
      const savedPreference = normalizeLanguagePreference(
        storedPreference ?? settings?.language,
      );
      setPreference(savedPreference);
      const savedLanguage =
        savedPreference === 'system' ? detectDeviceLanguage() : savedPreference;
      if (!storedPreference) {
        void writeStoredLanguagePreference(savedPreference).catch(() => undefined);
      }
      if (settings && settings.language !== savedPreference) {
        void writeSettings(db, {
          ...settings,
          language: savedPreference,
        }).catch(() => undefined);
      }
      if (!isBundledLanguage(savedLanguage)) {
        void ensureLanguage(savedLanguage).catch(() => undefined);
      }
    });
    return () => {
      active = false;
    };
  }, [db, ensureLanguage]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const nextDeviceLanguage = detectDeviceLanguage();
        setDeviceLanguage(nextDeviceLanguage);
        if (preference === 'system' && !isBundledLanguage(nextDeviceLanguage)) {
          void ensureLanguage(nextDeviceLanguage).catch(() => undefined);
        }
      }
    });
    return () => subscription.remove();
  }, [ensureLanguage, preference]);

  const language = preference === 'system' ? deviceLanguage : preference;

  const setLanguagePreference = useCallback(
    async (nextPreference: LanguagePreference) => {
      const nextLanguage = nextPreference === 'system' ? detectDeviceLanguage() : nextPreference;
      await ensureLanguage(nextLanguage);
      if (nextPreference === 'system') setDeviceLanguage(nextLanguage);
      setPreference(nextPreference);
      await writeStoredLanguagePreference(nextPreference).catch(() => undefined);
      void readSettings(db)
        .then((settings) =>
          writeSettings(db, { ...settings, language: nextPreference }),
        )
        .catch(() => undefined);
    },
    [db, ensureLanguage],
  );

  const dictionary = isBundledLanguage(language)
    ? translations[language]
    : dynamicPacks[language] ?? englishTranslations;

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      interpolate(dictionary[key] ?? englishTranslations[key], params),
    [dictionary],
  );

  const value = useMemo<LocalizationValue>(
    () => ({
      language,
      languageTag: language,
      preference,
      preparingLanguage,
      setLanguagePreference,
      t,
    }),
    [language, preference, preparingLanguage, setLanguagePreference, t],
  );

  return <LocalizationContext value={value}>{children}</LocalizationContext>;
}

export function useLocalization(): LocalizationValue {
  const value = use(LocalizationContext);
  if (!value) throw new Error('useLocalization must be used inside LocalizationProvider');
  return value;
}
