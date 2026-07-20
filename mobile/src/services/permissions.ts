import { AudioModule } from 'expo-audio';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

import type { SensorHealth } from '@/types/domain';

export interface PermissionSnapshot {
  camera: boolean;
  microphone: boolean;
  motion: boolean;
  locationForeground: boolean;
  locationBackground: boolean;
}

export async function requestCorePermissions(): Promise<PermissionSnapshot> {
  const [camera, microphone, motion, foreground] = await Promise.all([
    Camera.requestCameraPermissionsAsync(),
    AudioModule.requestRecordingPermissionsAsync(),
    DeviceMotion.requestPermissionsAsync(),
    Location.requestForegroundPermissionsAsync(),
  ]);

  let backgroundGranted = false;
  if (foreground.granted) {
    const background = await Location.requestBackgroundPermissionsAsync();
    backgroundGranted = background.granted;
  }

  return {
    camera: camera.granted,
    microphone: microphone.granted,
    motion: motion.granted,
    locationForeground: foreground.granted,
    locationBackground: backgroundGranted,
  };
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

