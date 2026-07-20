import type { Assessment, MotionFeatures } from '@/types/domain';

export function localFallbackAssessment(motion: MotionFeatures): Assessment {
  const severeMotion = motion.impactAfterFreeFall || motion.peakAccelerationG >= 3.2;
  const concerningMotion = severeMotion || motion.jerkRms >= 12 || motion.rotationRms >= 220;
  return {
    assessmentId: `local-${Date.now()}`,
    riskLevel: severeMotion ? 'alert' : concerningMotion ? 'watch' : 'safe',
    confidence: severeMotion ? 0.68 : concerningMotion ? 0.45 : 0.9,
    fusedScore: severeMotion ? 0.66 : concerningMotion ? 0.36 : 0.08,
    needsEvidenceCapture: false,
    explanation: severeMotion
      ? 'A possible fall or impact was detected while local AI was unavailable.'
      : concerningMotion
        ? 'Unusual movement is being validated.'
        : 'No strong local distress pattern detected.',
    factors: severeMotion ? ['Possible fall-impact sequence', 'Inference service offline'] : [],
    matchedPatterns: [],
    modelVersion: 'motion-fallback-v1',
    latencyMs: 0,
  };
}

