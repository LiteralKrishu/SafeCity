import * as Notifications from 'expo-notifications';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import type { EventSubscription } from 'expo-modules-core';

import SafeCityVoiceTrigger, {
  type PersistentVoiceTriggerStartResult,
  type PersistentVoiceTriggerState,
} from '../../modules/safecity-voice-trigger';
import {
  getBundledVoiceTriggerModelDirectoryUri,
  prepareVoiceTrigger,
  type VoiceTriggerKeyword,
  type VoiceTriggerPreparation,
} from '@/services/voice-trigger';

export interface VoiceTriggerEnableResult extends VoiceTriggerPreparation {
  fullScreenAllowed: boolean;
}

const UNAVAILABLE_STATE: PersistentVoiceTriggerState = {
  configured: false,
  enabled: false,
  protectionEnabled: false,
  listening: false,
  motionMonitoring: false,
  detectionPending: false,
  voiceResumeRequired: false,
  fullScreenAllowed: false,
};

export function isPersistentVoiceTriggerAvailable(): boolean {
  return process.env.EXPO_OS === 'android' && SafeCityVoiceTrigger !== null;
}

export async function enableVoiceTrigger(
  listenNow = true,
): Promise<VoiceTriggerEnableResult> {
  if (!isPersistentVoiceTriggerAvailable()) {
    const preparation = await prepareVoiceTrigger();
    return { ...preparation, fullScreenAllowed: true };
  }

  const microphonePermission = await requestRecordingPermissionsAsync();
  if (!microphonePermission.granted) {
    return {
      ready: false,
      message: 'Microphone permission is required for the voice SOS trigger.',
      fullScreenAllowed: false,
    };
  }

  const notificationPermission = await Notifications.requestPermissionsAsync();
  if (!notificationPermission.granted) {
    return {
      ready: false,
      message:
        'Notification permission is required so SafeCity can keep voice SOS active and show its countdown.',
      fullScreenAllowed: false,
    };
  }

  try {
    const modelDirectoryUri = await getBundledVoiceTriggerModelDirectoryUri();
    return await SafeCityVoiceTrigger!.startAsync(modelDirectoryUri, listenNow);
  } catch (error) {
    return {
      ready: false,
      message:
        error instanceof Error
          ? error.message
          : 'SafeCity could not prepare its offline emergency-word listener.',
      fullScreenAllowed: false,
    };
  }
}

export async function disablePersistentVoiceTrigger(): Promise<void> {
  await SafeCityVoiceTrigger?.stopAsync();
}

export async function enablePersistentProtection(): Promise<void> {
  await SafeCityVoiceTrigger?.startProtectionAsync();
}

export async function disablePersistentProtection(): Promise<void> {
  await SafeCityVoiceTrigger?.stopProtectionAsync();
}

export async function setPersistentProtectionActive(active: boolean): Promise<void> {
  await SafeCityVoiceTrigger?.setProtectionActiveAsync(active);
}

export async function setPersistentVoiceTriggerListening(
  listenNow: boolean,
): Promise<void> {
  await SafeCityVoiceTrigger?.setListeningAsync(listenNow);
}

export async function rearmPersistentVoiceTrigger(): Promise<void> {
  await SafeCityVoiceTrigger?.rearmAsync();
}

export async function getPersistentVoiceTriggerState(): Promise<PersistentVoiceTriggerState> {
  if (!SafeCityVoiceTrigger) return UNAVAILABLE_STATE;
  try {
    return await SafeCityVoiceTrigger.getStateAsync();
  } catch {
    return UNAVAILABLE_STATE;
  }
}

export async function openVoiceTriggerOverlaySettings(): Promise<void> {
  await SafeCityVoiceTrigger?.openFullScreenIntentSettingsAsync();
}

export function addPersistentVoiceTriggerListener(
  listener: (event: { keyword: VoiceTriggerKeyword }) => void,
): EventSubscription | null {
  if (!SafeCityVoiceTrigger) return null;
  return SafeCityVoiceTrigger.addListener('onKeywordDetected', (event) => {
    listener({ keyword: event.keyword as VoiceTriggerKeyword });
  });
}

export function addPersistentSafetyTriggerListener(
  listener: (event: { source: 'motion' | 'audio' | 'threat'; label: string }) => void,
): EventSubscription | null {
  if (!SafeCityVoiceTrigger) return null;
  return SafeCityVoiceTrigger.addListener('onSafetyDetected', (event) => {
    if (
      event.source !== 'motion' &&
      event.source !== 'audio' &&
      event.source !== 'threat'
    ) {
      return;
    }
    listener({ source: event.source, label: event.label });
  });
}

export type {
  PersistentVoiceTriggerStartResult,
  PersistentVoiceTriggerState,
};
