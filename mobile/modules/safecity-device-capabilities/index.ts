import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeDeviceCapabilities {
  androidApi: number;
  cpuCores: number;
  glEsVersion: string;
  hasLowLatencyAudio: boolean;
  isLowRamDevice: boolean;
  largeMemoryClassMb: number;
  memoryClassMb: number;
  supportedAbis: string[];
  totalMemoryMb: number;
}

interface SafeCityDeviceCapabilitiesModule {
  getCapabilities(): NativeDeviceCapabilities;
}

export default requireOptionalNativeModule<SafeCityDeviceCapabilitiesModule>(
  'SafeCityDeviceCapabilities',
);
