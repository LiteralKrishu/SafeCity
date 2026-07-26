// About -25 dBFS after outdoor-noise conditioning. This rejects nearby soft
// speech while allowing a raised voice or shout to activate HELP/BACHAO SOS.
export const HELP_BACHAO_MIN_RMS = 0.055;
export const HELP_BACHAO_LOUDNESS_WINDOW_MS = 1_500;
export const LOUDNESS_GATED_EMERGENCY_KEYWORDS = ['HELP', 'BACHAO'] as const;

const loudnessGatedKeywords = new Set<string>(LOUDNESS_GATED_EMERGENCY_KEYWORDS);

export function emergencyKeywordPassesLoudnessGate(
  keyword: string,
  rms: number,
): boolean {
  return !loudnessGatedKeywords.has(keyword) || rms >= HELP_BACHAO_MIN_RMS;
}
