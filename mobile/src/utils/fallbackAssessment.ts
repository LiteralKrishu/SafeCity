import { scoreCalibratedMotion } from '@/inference/safetyCalibration';
import type { Assessment, MotionFeatures } from '@/types/domain';

export function localFallbackAssessment(motion: MotionFeatures): Assessment {
  const motionScore = scoreCalibratedMotion(motion).score;
  const severeMotion = motion.impactAfterFreeFall || motionScore >= 0.86;
  const concerningMotion = severeMotion || motionScore >= 0.42;
  return {
    assessmentId: `local-${Date.now()}`,
    riskLevel: severeMotion ? 'alert' : concerningMotion ? 'watch' : 'safe',
    confidence: severeMotion ? 0.68 : concerningMotion ? 0.45 : 0.9,
    fusedScore: severeMotion ? 0.66 : concerningMotion ? 0.36 : 0.08,
    needsEvidenceCapture: false,
    explanation: severeMotion
      ? 'A possible fall or impact was detected while on-device audio AI was unavailable.'
      : concerningMotion
        ? 'Unusual movement is being validated.'
        : 'No strong local distress pattern detected.',
    factors: severeMotion ? ['Possible fall-impact sequence', 'On-device audio AI unavailable'] : [],
    matchedPatterns: [],
    modelVersion: 'on-device-motion-fallback-v3.2',
    latencyMs: 0,
  };
}
