import {
  inferOnDeviceAudio,
  ON_DEVICE_MODEL_VERSION,
  unavailableAudioInference,
  type LocalAudioInference,
} from '@/inference/onDeviceAudio';
import type { Assessment, MotionFeatures, RetrievedPattern, RiskLevel } from '@/types/domain';

type PatternPolarity = 'risk' | 'suppress';

interface PatternDefinition extends RetrievedPattern {
  polarity: PatternPolarity;
  severity: number;
}

interface WindowEvidence {
  audio: number;
  motion: number;
  fused: number;
  multiSignal: boolean;
}

interface SessionMemory {
  windows: WindowEvidence[];
  lastLevel: RiskLevel;
  lastSeen: number;
  incidentOpenUntil: number;
}

const sessions = new Map<string, SessionMemory>();

const PATTERNS = {
  coincident: {
    id: 'coincident-scream-impact',
    name: 'Distress vocalization with abrupt impact',
    similarity: 0,
    rationale: 'Independent audio and motion signals agree within the same short window.',
    polarity: 'risk',
    severity: 1,
  },
  sustained: {
    id: 'sustained-distress-struggle',
    name: 'Sustained distress with struggle-like motion',
    similarity: 0,
    rationale: 'Persistence and cross-signal agreement reduce the chance of a single accidental trigger.',
    polarity: 'risk',
    severity: 0.9,
  },
  fall: {
    id: 'fall-sequence',
    name: 'Free-fall followed by impact',
    similarity: 0,
    rationale: 'The ordered motion sequence is more specific than a high acceleration spike alone.',
    polarity: 'risk',
    severity: 0.78,
  },
  media: {
    id: 'media-playback',
    name: 'Likely television or music playback',
    similarity: 0,
    rationale: 'Media audio is a common source of false alarms and requires independent physical evidence.',
    polarity: 'suppress',
    severity: 0.85,
  },
  drop: {
    id: 'device-drop',
    name: 'Likely device drop',
    similarity: 0,
    rationale: 'An isolated phone drop should prompt validation, not an automatic SOS.',
    polarity: 'suppress',
    severity: 0.65,
  },
  transport: {
    id: 'transport-vibration',
    name: 'Likely vehicle vibration',
    similarity: 0,
    rationale: 'Ordinary travel motion is down-weighted unless another independent signal agrees.',
    polarity: 'suppress',
    severity: 0.55,
  },
} satisfies Record<string, PatternDefinition>;

function clip(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function calculateMotionScore(motion: MotionFeatures): {
  score: number;
  factors: string[];
} {
  if (motion.sampleCount < 3) return { score: 0, factors: [] };
  if (motion.impactAfterFreeFall) {
    return { score: 0.97, factors: ['Ordered free-fall and impact sequence'] };
  }

  const acceleration = clip((motion.peakAccelerationG - 1.35) / 2.3);
  const jerk = clip((motion.jerkRms - 4) / 22);
  const rotation = clip((motion.rotationRms - 65) / 320);
  const factors: string[] = [];
  if (acceleration >= 0.5) factors.push(`High acceleration (${motion.peakAccelerationG.toFixed(1)}g)`);
  if (jerk >= 0.5) factors.push('Repeated abrupt movement');
  if (rotation >= 0.5) factors.push('Rapid device rotation');
  return { score: clip(0.52 * acceleration + 0.3 * jerk + 0.18 * rotation), factors };
}

function withSimilarity(pattern: PatternDefinition, similarity: number): PatternDefinition {
  return { ...pattern, similarity: clip(similarity) };
}

function retrievePatterns(
  audio: LocalAudioInference,
  motion: MotionFeatures,
  motionScore: number,
): PatternDefinition[] {
  const matches: PatternDefinition[] = [];

  let coincident =
    0.55 * clip(audio.distressScore / 0.68) + 0.45 * clip(motionScore / 0.55);
  if (audio.distressScore < 0.68 || motionScore < 0.55) coincident *= 0.35;
  matches.push(withSimilarity(PATTERNS.coincident, coincident));

  let sustained =
    0.62 * clip(audio.distressScore / 0.62) + 0.38 * clip(motionScore / 0.45);
  if (audio.distressScore < 0.62 || motionScore < 0.45) sustained *= 0.35;
  matches.push(withSimilarity(PATTERNS.sustained, sustained));

  if (motion.impactAfterFreeFall) matches.push(withSimilarity(PATTERNS.fall, 1));

  if (audio.mediaScore >= 0.25) {
    matches.push(withSimilarity(PATTERNS.media, audio.mediaScore / 0.65));
  }

  if (
    !motion.impactAfterFreeFall &&
    motionScore >= 0.45 &&
    audio.distressScore < 0.35
  ) {
    const drop = clip(motionScore / 0.7) * (1 - audio.distressScore);
    matches.push(withSimilarity(PATTERNS.drop, drop));
  }

  if (
    !motion.impactAfterFreeFall &&
    motionScore >= 0.25 &&
    audio.distressScore < 0.2
  ) {
    const transport = clip(motionScore / 0.5) * (1 - audio.distressScore);
    matches.push(withSimilarity(PATTERNS.transport, transport));
  }

  return matches
    .filter((match) => match.similarity >= 0.06)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);
}

function expireSessions(now: number): void {
  for (const [sessionId, memory] of sessions) {
    if (now - memory.lastSeen > 60 * 60 * 1_000) sessions.delete(sessionId);
  }
}

export function resetLocalSession(sessionId?: string): void {
  if (sessionId) sessions.delete(sessionId);
  else sessions.clear();
}

export async function assessLocalSignalWindow(input: {
  audioBytes: Uint8Array | null;
  sampleRate: number;
  motion: MotionFeatures;
  context: { hour: number; appState: string };
  sessionId: string;
}): Promise<Assessment> {
  const startedAt = Date.now();
  const audio = input.audioBytes
    ? await inferOnDeviceAudio(input.audioBytes, input.sampleRate)
    : unavailableAudioInference();
  const motion = calculateMotionScore(input.motion);
  const matches = retrievePatterns(audio, input.motion, motion.score);
  const ragRisk = matches
    .filter((match) => match.polarity === 'risk')
    .reduce((highest, match) => Math.max(highest, match.similarity * match.severity), 0);
  const ragSuppression = matches
    .filter((match) => match.polarity === 'suppress')
    .reduce((highest, match) => Math.max(highest, match.similarity * match.severity), 0);
  const hasMotion =
    motion.score > 0 || matches.some((match) => ['fall-sequence', 'device-drop'].includes(match.id));

  let fused: number;
  if (audio.available && hasMotion) {
    fused = 0.52 * audio.distressScore + 0.36 * motion.score + 0.12 * ragRisk;
  } else if (audio.available) {
    fused = 0.79 * audio.distressScore + 0.21 * ragRisk;
  } else {
    fused = 0.79 * motion.score + 0.21 * ragRisk;
  }

  const multiSignal = audio.distressScore >= 0.48 && motion.score >= 0.42;
  if (multiSignal) fused += 0.12;
  const mediaPenalty = Math.min(
    Math.max(audio.mediaScore - audio.distressScore * 0.55, 0) * 0.4,
    0.22,
  );
  const isolatedSuppression = ragSuppression * (multiSignal ? 0.06 : 0.22);
  fused *= 1 - mediaPenalty - isolatedSuppression;
  if (input.context.hour >= 22 || input.context.hour <= 5) fused *= 1.03;
  fused = clip(fused);

  const now = Date.now();
  expireSessions(now);
  const memory = sessions.get(input.sessionId) ?? {
    windows: [],
    lastLevel: 'safe' as RiskLevel,
    lastSeen: now,
    incidentOpenUntil: 0,
  };
  memory.lastSeen = now;
  memory.windows.push({
    audio: audio.distressScore,
    motion: motion.score,
    fused,
    multiSignal,
  });
  memory.windows = memory.windows.slice(-8);

  const recent = memory.windows.slice(-2);
  const persistentMulti =
    recent.length === 2 && recent.every((window) => window.multiSignal && window.fused >= 0.63);
  const persistentAudio =
    recent.length === 2 && recent.every((window) => window.audio >= 0.7);
  const exceptional =
    audio.distressScore >= 0.88 &&
    motion.score >= 0.82 &&
    input.motion.impactAfterFreeFall &&
    ragSuppression < 0.45;
  const canOpenIncident = now >= memory.incidentOpenUntil;

  let riskLevel: RiskLevel;
  let needsEvidenceCapture = false;
  if (canOpenIncident && (exceptional || persistentMulti)) {
    riskLevel = 'sos';
    needsEvidenceCapture = true;
    memory.incidentOpenUntil = now + 120_000;
  } else if (fused >= 0.56 || persistentAudio || motion.score >= 0.86) {
    riskLevel = 'alert';
  } else if (fused >= 0.3) {
    riskLevel = 'watch';
  } else {
    riskLevel = 'safe';
  }
  if (memory.lastLevel === 'alert' && riskLevel === 'safe') riskLevel = 'watch';
  memory.lastLevel = riskLevel;
  sessions.set(input.sessionId, memory);

  const factors = [...audio.factors, ...motion.factors];
  if (multiSignal) factors.push('Audio and motion agree');
  if (persistentMulti) factors.push('Pattern confirmed across consecutive windows');
  if (audio.mediaScore >= 0.35) factors.push('Media-playback suppression applied');

  const explanation =
    riskLevel === 'sos'
      ? 'Multiple independent signals indicate possible distress. Local evidence capture requested.'
      : riskLevel === 'alert'
        ? 'A concerning signal needs a discreet check-in before escalation.'
        : riskLevel === 'watch'
          ? 'An unusual signal is being silently validated.'
          : 'No confirmed distress pattern is present.';

  return {
    assessmentId: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
    riskLevel,
    confidence: fused,
    fusedScore: fused,
    needsEvidenceCapture,
    explanation,
    factors: [...new Set(factors)].slice(0, 6),
    matchedPatterns: matches.map(({ id, name, similarity, rationale }) => ({
      id,
      name,
      similarity,
      rationale,
    })),
    modelVersion: ON_DEVICE_MODEL_VERSION,
    latencyMs: Date.now() - startedAt,
  };
}
