import * as SecureStore from 'expo-secure-store';

import {
  isSupportedLanguage,
  type LanguagePreference,
} from '@/i18n/types';

const LANGUAGE_PREFERENCE_KEY = 'safecity.language-preference.v1';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function readStoredLanguagePreference(): Promise<LanguagePreference | null> {
  const value = await SecureStore.getItemAsync(
    LANGUAGE_PREFERENCE_KEY,
    secureStoreOptions,
  );
  return value === 'system' || isSupportedLanguage(value) ? value : null;
}

export async function writeStoredLanguagePreference(
  preference: LanguagePreference,
): Promise<void> {
  await SecureStore.setItemAsync(
    LANGUAGE_PREFERENCE_KEY,
    preference,
    secureStoreOptions,
  );
}

export async function clearStoredLanguagePreference(): Promise<void> {
  await SecureStore.deleteItemAsync(
    LANGUAGE_PREFERENCE_KEY,
    secureStoreOptions,
  );
}
