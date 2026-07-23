import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import {
  deleteIncidentRecord,
  listIncidentsBefore,
  readSettings,
} from '@/db/repository';
import { deleteEvidenceFiles } from '@/services/evidence';

const DAY_MS = 24 * 60 * 60 * 1_000;

export function StartupMaintenance() {
  const db = useSQLiteContext();

  useEffect(() => {
    let cancelled = false;

    const purgeExpiredLocalData = async () => {
      const settings = await readSettings(db);
      const cutoff = new Date(Date.now() - settings.retentionDays * DAY_MS).toISOString();
      const expired = await listIncidentsBefore(db, cutoff);
      if (cancelled) return;

      await db.withTransactionAsync(async () => {
        for (const incident of expired) {
          deleteEvidenceFiles([
            incident.snapshotAudioUri,
            incident.rearPhotoUri,
            incident.frontPhotoUri,
            incident.audioUri,
          ]);
          await deleteIncidentRecord(db, incident.id);
        }
      });
    };

    void purgeExpiredLocalData().catch(() => {
      // A failed cleanup is retried on the next app start; it must never block the safety UI.
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  return null;
}
