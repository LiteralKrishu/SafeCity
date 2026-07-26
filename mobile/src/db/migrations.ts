import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

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
      role TEXT NOT NULL DEFAULT 'guardian',
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
      snapshot_audio_uri TEXT,
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

    CREATE TABLE IF NOT EXISTS anonymous_risk_queue (
      dedupe_token TEXT PRIMARY KEY NOT NULL,
      cell_id TEXT NOT NULL,
      time_bucket TEXT NOT NULL,
      event_kind TEXT NOT NULL,
      accuracy_band TEXT NOT NULL,
      queued_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT
    );

    CREATE INDEX IF NOT EXISTS anonymous_risk_queue_created_idx
      ON anonymous_risk_queue(queued_at);

    CREATE TABLE IF NOT EXISTS behavior_baseline (
      profile_key TEXT PRIMARY KEY NOT NULL,
      day_type INTEGER NOT NULL,
      time_bucket INTEGER NOT NULL,
      cell_x INTEGER NOT NULL,
      cell_y INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      mean_motion REAL NOT NULL,
      variance_motion REAL NOT NULL,
      speed_count INTEGER NOT NULL,
      mean_speed REAL NOT NULL,
      variance_speed REAL NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS behavior_baseline_time_idx
      ON behavior_baseline(day_type, time_bucket);
    CREATE INDEX IF NOT EXISTS behavior_baseline_seen_idx
      ON behavior_baseline(last_seen_at);

    CREATE TABLE IF NOT EXISTS behavior_baseline_days (
      day_key TEXT PRIMARY KEY NOT NULL,
      sample_count INTEGER NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);

  if (currentVersion < 2 && currentVersion > 0) {
    try {
      await db.execAsync('ALTER TABLE incidents ADD COLUMN snapshot_audio_uri TEXT;');
    } catch {
      // Older installs may already have this column from a partial upgrade.
    }
  }

  if (currentVersion < 5 && currentVersion > 0) {
    try {
      await db.execAsync(
        "ALTER TABLE contacts ADD COLUMN role TEXT NOT NULL DEFAULT 'guardian';",
      );
    } catch {
      // Existing installs may already have this column from a partial upgrade.
    }
  }

  await db.runAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
