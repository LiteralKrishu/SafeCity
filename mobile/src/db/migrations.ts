import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL,
      state TEXT NOT NULL,
      risk_score REAL NOT NULL,
      summary TEXT NOT NULL,
      factors_json TEXT NOT NULL,
      patterns_json TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      rear_photo_uri TEXT,
      front_photo_uri TEXT,
      audio_uri TEXT,
      evidence_status TEXT NOT NULL,
      model_version TEXT NOT NULL,
      feedback TEXT,
      resolved_at TEXT,
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS incidents_created_at_idx ON incidents(created_at DESC);
    CREATE INDEX IF NOT EXISTS incidents_state_idx ON incidents(state);
  `);

  await db.runAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

