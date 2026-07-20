import { fetch } from 'expo/fetch';
import type { File } from 'expo-file-system';

import type { Assessment, MotionFeatures } from '@/types/domain';

interface AnalyzeMetadata {
  deviceId: string;
  sessionId: string;
  sampleRate: number;
  motion: MotionFeatures;
  context: {
    hour: number;
    appState: string;
  };
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/u, '');
}

export async function checkInferenceHealth(serviceUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await fetch(`${normalizeBaseUrl(serviceUrl)}/health`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeSignalWindow(
  serviceUrl: string,
  audioFile: File | null,
  metadata: AnalyzeMetadata,
): Promise<Assessment> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${normalizeBaseUrl(serviceUrl)}/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-SafeCity-Metadata': encodeURIComponent(JSON.stringify(metadata)),
      },
      body: audioFile ?? new Uint8Array(),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Inference service returned ${response.status}`);
    return (await response.json()) as Assessment;
  } finally {
    clearTimeout(timeout);
  }
}
