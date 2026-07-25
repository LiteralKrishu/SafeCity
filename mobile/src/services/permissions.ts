import { AudioModule } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { DeviceMotion } from 'expo-sensors';

import {
  getPersistentVoiceTriggerState,
  isPersistentVoiceTriggerAvailable,
} from '@/services/persistent-voice-trigger';
import type { SensorHealth } from '@/types/domain';

export interface PermissionSnapshot {
  camera: boolean;
  microphone: boolean;
  motion: boolean;
  locationForeground: boolean;
  locationPrecise: boolean;
  locationBackground: boolean;
  notifications: boolean;
  fullScreenAlerts: boolean;
}

function hasPreciseLocation(permission: Location.LocationPermissionResponse): boolean {
  if (!permission.granted) return false;
  if (permission.android) return permission.android.accuracy === 'fine';
  if (permission.ios) return permission.ios.accuracy === 'full';
  return true;
}

async function fullScreenAlertsAllowed(): Promise<boolean> {
  if (!isPersistentVoiceTriggerAvailable()) return true;
  return (await getPersistentVoiceTriggerState()).fullScreenAllowed;
}

async function permissionSnapshot(
  camera: Awaited<ReturnType<typeof Camera.getCameraPermissionsAsync>>,
  microphone: Awaited<ReturnType<typeof AudioModule.getRecordingPermissionsAsync>>,
  motion: Awaited<ReturnType<typeof DeviceMotion.getPermissionsAsync>>,
  foreground: Location.LocationPermissionResponse,
  background: Location.LocationPermissionResponse,
  notifications: Notifications.NotificationPermissionsStatus,
): Promise<PermissionSnapshot> {
  const motionAvailable = await DeviceMotion.isAvailableAsync().catch(() => false);
  return {
    camera: camera.granted,
    microphone: microphone.granted,
    motion: motion.granted && motionAvailable,
    locationForeground: foreground.granted,
    locationPrecise: hasPreciseLocation(foreground),
    locationBackground: background.granted,
    notifications: notifications.granted,
    fullScreenAlerts: await fullScreenAlertsAllowed(),
  };
}

export function allCorePermissionsGranted(snapshot: PermissionSnapshot): boolean {
  return Object.values(snapshot).every(Boolean);
}

export async function getCorePermissionSnapshot(): Promise<PermissionSnapshot> {
  const [camera, microphone, motion, foreground, background, notifications] =
    await Promise.all([
      Camera.getCameraPermissionsAsync(),
      AudioModule.getRecordingPermissionsAsync(),
      DeviceMotion.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);
  return permissionSnapshot(
    camera,
    microphone,
    motion,
    foreground,
    background,
    notifications,
  );
}

export async function requestCorePermissions(): Promise<PermissionSnapshot> {
  // Request one permission at a time. Concurrent Android permission dialogs can
  // dismiss or supersede one another and leave setup in a partially granted state.
  const camera = await Camera.requestCameraPermissionsAsync();
  const microphone = await AudioModule.requestRecordingPermissionsAsync();
  const motion = await DeviceMotion.requestPermissionsAsync();
  const foreground = await Location.requestForegroundPermissionsAsync();

  let background = await Location.getBackgroundPermissionsAsync();
  if (foreground.granted) {
    background = await Location.requestBackgroundPermissionsAsync();
  }
  const notifications = await Notifications.requestPermissionsAsync();

  return permissionSnapshot(
    camera,
    microphone,
    motion,
    foreground,
    background,
    notifications,
  );
}

export async function getSensorHealth(): Promise<Partial<SensorHealth>> {
  const [camera, microphone, motion, location, motionAvailable] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    AudioModule.getRecordingPermissionsAsync(),
    DeviceMotion.getPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
    DeviceMotion.isAvailableAsync(),
  ]);
  return {
    camera: camera.granted ? 'ready' : 'blocked',
    microphone: microphone.granted ? 'ready' : 'blocked',
    motion: motion.granted && motionAvailable ? 'ready' : 'blocked',
    location: location.granted ? 'ready' : 'blocked',
  };
}
