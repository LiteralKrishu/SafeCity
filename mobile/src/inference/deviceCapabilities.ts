import { Platform } from 'react-native';

import SafeCityDeviceCapabilities, {
  type NativeDeviceCapabilities,
} from '../../modules/safecity-device-capabilities';

export type DeviceInferenceTier = 'limited' | 'balanced' | 'high';

export interface DeviceInferenceCapabilities {
  androidApi: number | null;
  cpuCores: number | null;
  glEsVersion: string | null;
  hasLowLatencyAudio: boolean | null;
  isLowRamDevice: boolean | null;
  largeMemoryClassMb: number | null;
  memoryClassMb: number | null;
  platform: string;
  supportedAbis: string[];
  tier: DeviceInferenceTier;
  totalMemoryMb: number | null;
}

function validNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function readAndroidCapabilities(): NativeDeviceCapabilities | null {
  if (!SafeCityDeviceCapabilities) return null;
  try {
    return SafeCityDeviceCapabilities.getCapabilities();
  } catch {
    return null;
  }
}

export function getDeviceInferenceCapabilities(): DeviceInferenceCapabilities {
  const native = Platform.OS === 'android' ? readAndroidCapabilities() : null;
  const totalMemoryMb = validNumber(native?.totalMemoryMb);
  const memoryClassMb = validNumber(native?.memoryClassMb);
  const cpuCores = validNumber(native?.cpuCores);
  const isLowRamDevice =
    typeof native?.isLowRamDevice === 'boolean' ? native.isLowRamDevice : null;

  const limited =
    isLowRamDevice === true ||
    (totalMemoryMb !== null && totalMemoryMb < 2_500) ||
    (memoryClassMb !== null && memoryClassMb < 192) ||
    (cpuCores !== null && cpuCores < 4);
  const high =
    !limited &&
    totalMemoryMb !== null &&
    totalMemoryMb >= 6_000 &&
    cpuCores !== null &&
    cpuCores >= 8;

  return {
    androidApi: validNumber(native?.androidApi),
    cpuCores,
    glEsVersion: native?.glEsVersion ?? null,
    hasLowLatencyAudio:
      typeof native?.hasLowLatencyAudio === 'boolean' ? native.hasLowLatencyAudio : null,
    isLowRamDevice,
    largeMemoryClassMb: validNumber(native?.largeMemoryClassMb),
    memoryClassMb,
    platform: Platform.OS,
    supportedAbis: Array.isArray(native?.supportedAbis) ? native.supportedAbis : [],
    tier: limited ? 'limited' : high ? 'high' : 'balanced',
    totalMemoryMb,
  };
}

export function describeDeviceCapabilities(
  capabilities: DeviceInferenceCapabilities,
): string {
  const details: string[] = [];
  if (capabilities.totalMemoryMb !== null) {
    details.push(`${Math.max(1, Math.round(capabilities.totalMemoryMb / 1_024))} GB RAM`);
  }
  if (capabilities.cpuCores !== null) {
    details.push(`${capabilities.cpuCores} CPU cores`);
  }
  if (capabilities.isLowRamDevice) details.push('Android low-RAM mode');
  if (!details.length) details.push(`${capabilities.platform} runtime benchmark`);
  return details.join(' · ');
}
