export type BundledLanguage = 'en' | 'hi' | 'bn';

export const supportedLanguages = [
  { code: 'af', label: 'Afrikaans' },
  { code: 'sq', label: 'Albanian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'be', label: 'Belarusian' },
  { code: 'bn', label: 'Bengali' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hr', label: 'Croatian' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'eo', label: 'Esperanto' },
  { code: 'et', label: 'Estonian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'gl', label: 'Galician' },
  { code: 'ka', label: 'Georgian' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ht', label: 'Haitian Creole' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'is', label: 'Icelandic' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ga', label: 'Irish' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ko', label: 'Korean' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ms', label: 'Malay' },
  { code: 'mt', label: 'Maltese' },
  { code: 'mr', label: 'Marathi' },
  { code: 'no', label: 'Norwegian' },
  { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'es', label: 'Spanish' },
  { code: 'sw', label: 'Swahili' },
  { code: 'sv', label: 'Swedish' },
  { code: 'tl', label: 'Tagalog' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'cy', label: 'Welsh' },
] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number]['code'];
export type LanguagePreference = 'system' | SupportedLanguage;

const languageCodeSet = new Set<string>(supportedLanguages.map(({ code }) => code));
const bundledLanguageSet = new Set<string>(['en', 'hi', 'bn']);

const languageAliases: Record<string, SupportedLanguage> = {
  cmn: 'zh',
  fil: 'tl',
  in: 'id',
  iw: 'he',
  nb: 'no',
  nn: 'no',
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && languageCodeSet.has(value);
}

export function isBundledLanguage(value: SupportedLanguage): value is BundledLanguage {
  return bundledLanguageSet.has(value);
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  return value === 'system' || isSupportedLanguage(value) ? value : 'system';
}

export function getLanguageDisplayName(
  code: SupportedLanguage,
  displayLanguage: string = code,
): string {
  const fallback = supportedLanguages.find((option) => option.code === code)?.label ?? code.toUpperCase();
  try {
    return new Intl.DisplayNames([displayLanguage], { type: 'language' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

export function detectDeviceLanguage(): SupportedLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    const baseCode = locale.split(/[-_]/u)[0] ?? 'en';
    const normalizedCode = languageAliases[baseCode] ?? baseCode;
    return isSupportedLanguage(normalizedCode) ? normalizedCode : 'en';
  } catch {
    return 'en';
  }
}
