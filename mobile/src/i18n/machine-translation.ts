import { onTranslateTask } from 'expo-translate-text';
import type { SQLiteDatabase } from 'expo-sqlite';

import { englishTranslations, type TranslationKey } from '@/i18n/translations';
import type { SupportedLanguage } from '@/i18n/types';

export type TranslationPack = Record<TranslationKey, string>;

const TRANSLATION_PACK_VERSION = 2;
const BRAND_TOKEN = '⟦0⟧';

interface CachedTranslationPack {
  version: number;
  language: SupportedLanguage;
  translations: TranslationPack;
}

function cacheKey(language: SupportedLanguage): string {
  return `translation-pack-v${TRANSLATION_PACK_VERSION}:${language}`;
}

function protectTemplate(template: string): { text: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const text = template
    .replace(/SafeCity/gu, BRAND_TOKEN)
    .replace(/\{\w+\}/gu, (placeholder) => {
      const index = placeholders.push(placeholder) - 1;
      return `⟦${index + 1}⟧`;
    });
  return { text, placeholders };
}

function restoreTemplate(text: string, placeholders: string[]): string {
  let restored = text.replaceAll(BRAND_TOKEN, 'SafeCity');
  placeholders.forEach((placeholder, index) => {
    restored = restored.replaceAll(`⟦${index + 1}⟧`, placeholder);
  });
  return restored;
}

function isCompletePack(value: unknown): value is TranslationPack {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (Object.keys(englishTranslations) as TranslationKey[]).every(
    (key) => typeof record[key] === 'string' && record[key].length > 0,
  );
}

export async function readCachedTranslationPack(
  db: SQLiteDatabase,
  language: SupportedLanguage,
): Promise<TranslationPack | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    cacheKey(language),
  );
  if (!row) return null;

  try {
    const cached = JSON.parse(row.value) as Partial<CachedTranslationPack>;
    if (
      cached.version !== TRANSLATION_PACK_VERSION ||
      cached.language !== language ||
      !isCompletePack(cached.translations)
    ) {
      return null;
    }
    return cached.translations;
  } catch {
    return null;
  }
}

async function writeCachedTranslationPack(
  db: SQLiteDatabase,
  language: SupportedLanguage,
  translations: TranslationPack,
): Promise<void> {
  const cached: CachedTranslationPack = {
    version: TRANSLATION_PACK_VERSION,
    language,
    translations,
  };
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    cacheKey(language),
    JSON.stringify(cached),
    new Date().toISOString(),
  );
}

export async function prepareTranslationPack(
  db: SQLiteDatabase,
  language: SupportedLanguage,
): Promise<TranslationPack> {
  const cached = await readCachedTranslationPack(db, language);
  if (cached) return cached;

  const protectedTemplates = Object.fromEntries(
    (Object.entries(englishTranslations) as Array<[TranslationKey, string]>).map(([key, value]) => {
      const protectedTemplate = protectTemplate(value);
      return [key, protectedTemplate] as const;
    }),
  ) as Record<TranslationKey, { text: string; placeholders: string[] }>;

  const result = await onTranslateTask({
    input: Object.fromEntries(
      (Object.entries(protectedTemplates) as Array<[
        TranslationKey,
        { text: string; placeholders: string[] },
      ]>).map(([key, value]) => [key, value.text]),
    ),
    sourceLangCode: 'en',
    targetLangCode: language,
    preferredStrategy: 'highFidelity',
    requireCharging: false,
    requiresWifi: false,
  });

  if (
    !result.translatedTexts ||
    typeof result.translatedTexts !== 'object' ||
    Array.isArray(result.translatedTexts)
  ) {
    throw new Error('The device returned an invalid translation pack.');
  }

  const translatedRecord = result.translatedTexts as Record<string, string | string[]>;
  const translations = Object.fromEntries(
    (Object.keys(englishTranslations) as TranslationKey[]).map((key) => {
      const translated = translatedRecord[key];
      if (typeof translated !== 'string' || translated.length === 0) {
        throw new Error(`The device did not translate ${key}.`);
      }
      const restored = restoreTemplate(translated, protectedTemplates[key].placeholders);
      const source = englishTranslations[key];
      const placeholdersRestored = protectedTemplates[key].placeholders.every((placeholder) =>
        restored.includes(placeholder),
      );
      const brandRestored = !source.includes('SafeCity') || restored.includes('SafeCity');
      if (!placeholdersRestored || !brandRestored || restored.includes('⟦')) {
        throw new Error(`The device changed a protected value in ${key}.`);
      }
      return [key, restored];
    }),
  );

  if (!isCompletePack(translations)) {
    throw new Error('The device returned an incomplete translation pack.');
  }

  await writeCachedTranslationPack(db, language, translations);
  return translations;
}
