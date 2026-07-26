export interface CalibratedMotionPoint {
  at: number;
  magnitudeG: number;
  rotationDps: number;
}

export interface CalibratedMotionFeatures {
  peakAccelerationG: number;
  jerkRms: number;
  rotationRms: number;
  peakRotationDps: number;
  angularTravelDegrees: number;
  freeFallObserved: boolean;
  freeFallDurationMs: number;
  impactAfterFreeFall: boolean;
  impactDelayMs: number | null;
  sampleCount: number;
}

export const SAFETY_CALIBRATION = {
  motionWindowMs: 5_000,
  maximumSampleGapMs: 250,
  freeFallThresholdG: 0.45,
  minimumFreeFallMs: 60,
  maximumFreeFallMs: 1_000,
  impactThresholdG: 2.4,
  maximumImpactDelayMs: 1_200,
  accelerationScoreStartG: 1.7,
  accelerationScoreRangeG: 2.3,
  jerkScoreStartGps: 8,
  jerkScoreRangeGps: 30,
  rotationScoreStartDps: 90,
  rotationScoreRangeDps: 360,
  angularTravelStartDegrees: 30,
  angularTravelRangeDegrees: 120,
} as const;

export interface CalibratedMotionScore {
  acceleration: number;
  jerk: number;
  rotation: number;
  angularTravel: number;
  score: number;
}

export interface AutomaticMotionTrigger {
  kind: 'fall' | 'violent-motion';
  label: string;
}

const AUTOMATIC_MOTION_THRESHOLDS = {
  strongImpactG: 3.4,
  fallRotationDegreesPerSecond: 149,
  fallAngularTravelDegrees: 30,
  violentAccelerationG: 2.8,
  violentJerkGps: 18,
  violentRotationDegreesPerSecond: 229,
  violentAngularTravelDegrees: 45,
} as const;

function clip01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function rms(values: number[]): number {
  return values.length
    ? Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length)
    : 0;
}

export function extractCalibratedMotionFeatures(
  inputPoints: CalibratedMotionPoint[],
): CalibratedMotionFeatures {
  const points = inputPoints
    .filter(
      (point) =>
        Number.isFinite(point.at) &&
        Number.isFinite(point.magnitudeG) &&
        Number.isFinite(point.rotationDps),
    )
    .map((point) => ({
      at: point.at,
      magnitudeG: finiteNonNegative(point.magnitudeG),
      rotationDps: finiteNonNegative(point.rotationDps),
    }))
    .sort((left, right) => left.at - right.at);

  if (points.length < 2) {
    return {
      peakAccelerationG: points[0]?.magnitudeG ?? 0,
      jerkRms: 0,
      rotationRms: points[0]?.rotationDps ?? 0,
      peakRotationDps: points[0]?.rotationDps ?? 0,
      angularTravelDegrees: 0,
      freeFallObserved: false,
      freeFallDurationMs: 0,
      impactAfterFreeFall: false,
      impactDelayMs: null,
      sampleCount: points.length,
    };
  }

  const jerks: number[] = [];
  let angularTravelDegrees = 0;
  let freeFallStartedAt: number | null = null;
  let confirmedFreeFallEndedAt: number | null = null;
  let freeFallDurationMs = 0;
  let impactAfterFreeFall = false;
  let impactDelayMs: number | null = null;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const elapsedMs = current.at - previous.at;
    if (elapsedMs <= 0 || elapsedMs > SAFETY_CALIBRATION.maximumSampleGapMs) {
      freeFallStartedAt = null;
      confirmedFreeFallEndedAt = null;
      continue;
    }

    const elapsedSeconds = elapsedMs / 1_000;
    jerks.push(Math.abs(current.magnitudeG - previous.magnitudeG) / elapsedSeconds);
    angularTravelDegrees +=
      ((current.rotationDps + previous.rotationDps) * 0.5) * elapsedSeconds;

    if (current.magnitudeG <= SAFETY_CALIBRATION.freeFallThresholdG) {
      if (freeFallStartedAt === null) {
        freeFallStartedAt =
          previous.magnitudeG <= SAFETY_CALIBRATION.freeFallThresholdG
            ? previous.at
            : current.at;
      }
      const duration = current.at - freeFallStartedAt;
      if (
        duration >= SAFETY_CALIBRATION.minimumFreeFallMs &&
        duration <= SAFETY_CALIBRATION.maximumFreeFallMs
      ) {
        freeFallDurationMs = Math.max(freeFallDurationMs, duration);
      }
      continue;
    }

    if (freeFallStartedAt !== null) {
      const duration = current.at - freeFallStartedAt;
      if (
        duration >= SAFETY_CALIBRATION.minimumFreeFallMs &&
        duration <= SAFETY_CALIBRATION.maximumFreeFallMs
      ) {
        freeFallDurationMs = Math.max(freeFallDurationMs, duration);
        confirmedFreeFallEndedAt = current.at;
      }
      freeFallStartedAt = null;
    }

    if (confirmedFreeFallEndedAt !== null) {
      const delay = current.at - confirmedFreeFallEndedAt;
      if (
        delay <= SAFETY_CALIBRATION.maximumImpactDelayMs &&
        current.magnitudeG >= SAFETY_CALIBRATION.impactThresholdG
      ) {
        impactAfterFreeFall = true;
        impactDelayMs = delay;
      } else if (delay > SAFETY_CALIBRATION.maximumImpactDelayMs) {
        confirmedFreeFallEndedAt = null;
      }
    }
  }

  return {
    peakAccelerationG: Math.max(...points.map((point) => point.magnitudeG)),
    jerkRms: rms(jerks),
    rotationRms: rms(points.map((point) => point.rotationDps)),
    peakRotationDps: Math.max(...points.map((point) => point.rotationDps)),
    angularTravelDegrees,
    freeFallObserved: freeFallDurationMs >= SAFETY_CALIBRATION.minimumFreeFallMs,
    freeFallDurationMs,
    impactAfterFreeFall,
    impactDelayMs,
    sampleCount: points.length,
  };
}

export function scoreCalibratedMotion(
  motion: CalibratedMotionFeatures,
): CalibratedMotionScore {
  if (motion.sampleCount < 5) {
    return { acceleration: 0, jerk: 0, rotation: 0, angularTravel: 0, score: 0 };
  }
  if (motion.impactAfterFreeFall) {
    return { acceleration: 1, jerk: 1, rotation: 1, angularTravel: 1, score: 0.96 };
  }

  const acceleration = clip01(
    (motion.peakAccelerationG - SAFETY_CALIBRATION.accelerationScoreStartG) /
      SAFETY_CALIBRATION.accelerationScoreRangeG,
  );
  const jerk = clip01(
    (motion.jerkRms - SAFETY_CALIBRATION.jerkScoreStartGps) /
      SAFETY_CALIBRATION.jerkScoreRangeGps,
  );
  const representativeRotationDps =
    motion.peakRotationDps * 0.65 + motion.rotationRms * 0.35;
  const rotation = clip01(
    (representativeRotationDps - SAFETY_CALIBRATION.rotationScoreStartDps) /
      SAFETY_CALIBRATION.rotationScoreRangeDps,
  );
  const angularTravel = clip01(
    (motion.angularTravelDegrees - SAFETY_CALIBRATION.angularTravelStartDegrees) /
      SAFETY_CALIBRATION.angularTravelRangeDegrees,
  );
  let score =
    acceleration * 0.42 + jerk * 0.28 + rotation * 0.18 + angularTravel * 0.12;
  const corroboratedImpact =
    acceleration >= 0.45 && (jerk >= 0.35 || rotation >= 0.3 || angularTravel >= 0.35);
  if (corroboratedImpact) score += 0.08;
  if (acceleration >= 0.55 && jerk < 0.2 && rotation < 0.15) score *= 0.68;

  return { acceleration, jerk, rotation, angularTravel, score: clip01(score) };
}

/**
 * Opens the existing SOS confirmation countdown only after independent motion
 * measurements agree. A single impact spike is deliberately not enough.
 */
export function getAutomaticMotionTrigger(
  motion: CalibratedMotionFeatures,
): AutomaticMotionTrigger | null {
  const fallCorroborated =
    motion.peakAccelerationG >= AUTOMATIC_MOTION_THRESHOLDS.strongImpactG ||
    motion.peakRotationDps >=
      AUTOMATIC_MOTION_THRESHOLDS.fallRotationDegreesPerSecond ||
    motion.angularTravelDegrees >=
      AUTOMATIC_MOTION_THRESHOLDS.fallAngularTravelDegrees;

  if (motion.impactAfterFreeFall && fallCorroborated) {
    return {
      kind: 'fall',
      label: `Free-fall ${Math.round(motion.freeFallDurationMs)} ms followed by ${motion.peakAccelerationG.toFixed(1)}g impact`,
    };
  }

  const violentMotionCorroborated =
    motion.peakAccelerationG >=
      AUTOMATIC_MOTION_THRESHOLDS.violentAccelerationG &&
    motion.jerkRms >= AUTOMATIC_MOTION_THRESHOLDS.violentJerkGps &&
    motion.peakRotationDps >=
      AUTOMATIC_MOTION_THRESHOLDS.violentRotationDegreesPerSecond &&
    motion.angularTravelDegrees >=
      AUTOMATIC_MOTION_THRESHOLDS.violentAngularTravelDegrees;

  if (violentMotionCorroborated) {
    return {
      kind: 'violent-motion',
      label: 'Strong impact, jerk and rotation detected together',
    };
  }

  return null;
}
