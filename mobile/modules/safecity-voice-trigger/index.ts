import {
  NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';

export interface PersistentVoiceTriggerState {
  configured: boolean;
  enabled: boolean;
  protectionEnabled: boolean;
  listening: boolean;
  motionMonitoring: boolean;
  detectionPending: boolean;
  voiceResumeRequired: boolean;
  fullScreenAllowed: boolean;
}

export interface PersistentVoiceTriggerStartResult {
  ready: boolean;
  message: string;
  fullScreenAllowed: boolean;
}

type SafeCityVoiceTriggerEvents = {
  onKeywordDetected(event: { keyword: string }): void;
  onSafetyDetected(event: { source: string; label: string }): void;
};

declare class SafeCityVoiceTriggerModule extends NativeModule<SafeCityVoiceTriggerEvents> {
  startAsync(
    modelDirectoryUri: string,
    listenNow: boolean,
  ): Promise<PersistentVoiceTriggerStartResult>;
  startProtectionAsync(): Promise<void>;
  stopProtectionAsync(): Promise<void>;
  setProtectionActiveAsync(active: boolean): Promise<void>;
  stopAsync(): Promise<void>;
  setListeningAsync(listenNow: boolean): Promise<void>;
  rearmAsync(): Promise<void>;
  getStateAsync(): Promise<PersistentVoiceTriggerState>;
  openFullScreenIntentSettingsAsync(): Promise<void>;
}

export default requireOptionalNativeModule<SafeCityVoiceTriggerModule>(
  'SafeCityVoiceTrigger',
);
