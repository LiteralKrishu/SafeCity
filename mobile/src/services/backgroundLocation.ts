import * as Location from 'expo-location';
import { openDatabaseAsync } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { unlockDatabase } from '@/db/DatabaseProvider';
import { writeSettingValue } from '@/db/repository';

export const LOCATION_TASK_NAME = 'safecity-background-location';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations.length) return;
  const location = data.locations.at(-1);
  if (!location) return;

  const db = await openDatabaseAsync('safecity.db');
  try {
    await unlockDatabase(db);
    await writeSettingValue(db, 'last-known-location', {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: new Date(location.timestamp).toISOString(),
    });
  } finally {
    await db.closeAsync();
  }
});

export async function startBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (running) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 50,
    deferredUpdatesDistance: 100,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SafeCity monitoring is active',
      notificationBody: 'Location is available for an active SOS.',
      notificationColor: '#07111F',
    },
  });
}

export async function stopBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

