import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const LOCATION_TASK_NAME = 'safecity-background-location';
const CURRENT_FIX_TIMEOUT_MS = 4_000;
const PRECISE_FIX_TIMEOUT_MS = 12_000;
const RECENT_FIX_MAX_AGE_MS = 15_000;
const NEWER_FIX_PRIORITY_MS = 5_000;
const TARGET_ACCURACY_METERS = 20;
const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

export interface SafeCityLocationFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

function toSafeCityLocation(location: Location.LocationObject): SafeCityLocationFix {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

function accuracyOf(location: SafeCityLocationFix | null): number {
  return location?.accuracy ?? Number.POSITIVE_INFINITY;
}

function moreAccurateLocation(
  current: SafeCityLocationFix | null,
  candidate: SafeCityLocationFix,
): SafeCityLocationFix {
  if (!current) return candidate;
  return accuracyOf(candidate) < accuracyOf(current) ? candidate : current;
}

function preferFreshLocation(
  current: SafeCityLocationFix | null,
  candidate: SafeCityLocationFix,
): SafeCityLocationFix {
  if (!current) return candidate;
  if (
    accuracyOf(candidate) > MAX_ACCEPTABLE_ACCURACY_METERS &&
    accuracyOf(current) <= MAX_ACCEPTABLE_ACCURACY_METERS
  ) {
    return current;
  }
  if (candidate.timestamp - current.timestamp >= NEWER_FIX_PRIORITY_MS) {
    return candidate;
  }
  return moreAccurateLocation(current, candidate);
}

async function getRecentAccurateLocation(): Promise<SafeCityLocationFix | null> {
  const location = await Location.getLastKnownPositionAsync({
    maxAge: RECENT_FIX_MAX_AGE_MS,
    requiredAccuracy: MAX_ACCEPTABLE_ACCURACY_METERS,
  });
  return location ? toSafeCityLocation(location) : null;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data?.locations.length) return;
  // Background updates keep the operating system's last-known fix fresh.
  // Avoid opening the foreground app's SQLite database from this headless task:
  // Android may share and later release the same native database connection.
});

export async function startBackgroundLocation(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (running) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 25,
    deferredUpdatesDistance: 50,
    deferredUpdatesInterval: 30_000,
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

export async function getCurrentLocation(): Promise<SafeCityLocationFix | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const recent = await getRecentAccurateLocation().catch(() => null);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const current = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), CURRENT_FIX_TIMEOUT_MS);
      }),
    ]);
    return current ? preferFreshLocation(recent, toSafeCityLocation(current)) : recent;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getRecentBackgroundLocation(
  maxAgeMs = 3 * 60_000,
): Promise<SafeCityLocationFix | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const location = await Location.getLastKnownPositionAsync({
    maxAge: maxAgeMs,
    requiredAccuracy: MAX_ACCEPTABLE_ACCURACY_METERS,
  });
  return location ? toSafeCityLocation(location) : null;
}

export async function getPreciseCurrentLocation(): Promise<SafeCityLocationFix | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;

  let best: SafeCityLocationFix | null = null;
  return new Promise((resolve) => {
    let settled = false;
    let subscription: Location.LocationSubscription | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      resolve(
        accuracyOf(best) <= MAX_ACCEPTABLE_ACCURACY_METERS
          ? best
          : null,
      );
    };

    const timeout = setTimeout(finish, PRECISE_FIX_TIMEOUT_MS);
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
        timeInterval: 500,
        distanceInterval: 0,
      },
      (location) => {
        best = moreAccurateLocation(best, toSafeCityLocation(location));
        if (accuracyOf(best) <= TARGET_ACCURACY_METERS) finish();
      },
    )
      .then((nextSubscription) => {
        subscription = nextSubscription;
        if (settled) nextSubscription.remove();
      })
      .catch(finish);
  });
}
