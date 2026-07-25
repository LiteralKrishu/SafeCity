import type { InferenceModelPreference } from '@/types/domain';

import {
  getDeviceInferenceCapabilities,
  type DeviceInferenceCapabilities,
} from '@/inference/deviceCapabilities';

export type ActiveInferenceModel = 'lite' | 'yamnet';

export interface InferenceModelOption {
  id: InferenceModelPreference;
  name: string;
  summary: string;
  bestFor: string;
}

export const inferenceModelOptions: InferenceModelOption[] = [
  {
    id: 'auto',
    name: 'Automatic',
    summary: 'Chooses the safest model for this phone and falls back automatically.',
    bestFor: 'Recommended for most phones',
  },
  {
    id: 'lite',
    name: 'Lite Fusion',
    summary: 'Uses lightweight audio signal analysis with motion confirmation.',
    bestFor: 'Low-memory phones and longer battery life',
  },
  {
    id: 'yamnet',
    name: 'YAMNet Neural',
    summary: 'Uses the bundled 521-class neural audio model with sensor fusion.',
    bestFor: 'Capable phones and richer sound context',
  },
];

export function isInferenceModelPreference(
  value: unknown,
): value is InferenceModelPreference {
  return value === 'auto' || value === 'lite' || value === 'yamnet';
}

export function recommendedInferenceModel(
  capabilities: DeviceInferenceCapabilities = getDeviceInferenceCapabilities(),
): ActiveInferenceModel {
  return capabilities.tier === 'limited' ? 'lite' : 'yamnet';
}

export function resolveInferenceModel(
  preference: InferenceModelPreference,
  capabilities: DeviceInferenceCapabilities = getDeviceInferenceCapabilities(),
): ActiveInferenceModel {
  return preference === 'auto' ? recommendedInferenceModel(capabilities) : preference;
}

export function inferenceModelName(model: ActiveInferenceModel): string {
  return model === 'yamnet' ? 'YAMNet Neural' : 'Lite Fusion';
}
