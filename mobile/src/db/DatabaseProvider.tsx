import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';

import { migrateDatabase } from './migrations';

const DATABASE_KEY_NAME = 'safecity.database-key.v1';

export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY_NAME, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (existing && /^[a-f0-9]{64}$/u.test(existing)) return existing;

  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DATABASE_KEY_NAME, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

export async function unlockDatabase(db: SQLiteDatabase): Promise<void> {
  const key = await getOrCreateDatabaseKey();
  // The key is generated internally and restricted to lowercase hexadecimal.
  await db.execAsync(`
    PRAGMA key = "x'${key}'";
    PRAGMA cipher_memory_security = ON;
    PRAGMA secure_delete = ON;
    PRAGMA foreign_keys = ON;
  `);
}

async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await unlockDatabase(db);
  await migrateDatabase(db);
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="safecity.db" onInit={initializeDatabase} useSuspense>
      {children}
    </SQLiteProvider>
  );
}
