export type ThreatPhraseLanguage = 'en' | 'hi' | 'bn';
export type ThreatPhraseSeverity = 'ambiguous' | 'coercive' | 'violent';

export type ThreatPhraseKeyword =
  | 'THREAT_DONT_SHOUT'
  | 'THREAT_GIVE_PHONE'
  | 'THREAT_SHUT_UP'
  | 'THREAT_DONT_MOVE'
  | 'THREAT_KILL_YOU'
  | 'THREAT_CHILLAO_MAT'
  | 'THREAT_PHONE_DE_DO'
  | 'THREAT_CHUP_RAHO'
  | 'THREAT_MAAR_DUNGA'
  | 'THREAT_CHITKAR_KORO_NA'
  | 'THREAT_PHONE_DAO'
  | 'THREAT_CHUP_KORO'
  | 'THREAT_MERE_FELBO';

export interface ThreatPhraseDefinition {
  keyword: ThreatPhraseKeyword;
  language: ThreatPhraseLanguage;
  display: string;
  meaning: string;
  severity: ThreatPhraseSeverity;
}

export interface ThreatPhraseMatch {
  keyword: ThreatPhraseKeyword;
  detectedAt: number;
}

export interface ThreatLanguageSignal {
  active: boolean;
  confirmed: boolean;
  factor: string | null;
  matchCount: number;
  physicalAgreement: boolean;
  score: number;
}

const SEVERITY_WEIGHT: Record<ThreatPhraseSeverity, number> = {
  ambiguous: 0.5,
  coercive: 0.78,
  violent: 1,
};

export const THREAT_MATCH_WINDOW_MS = 20_000;
export const THREAT_DUPLICATE_COOLDOWN_MS = 3_000;

export const THREAT_PHRASES: Record<ThreatPhraseKeyword, ThreatPhraseDefinition> = {
  THREAT_DONT_SHOUT: {
    keyword: 'THREAT_DONT_SHOUT',
    language: 'en',
    display: '“Don’t shout”',
    meaning: 'Possible silencing language',
    severity: 'ambiguous',
  },
  THREAT_GIVE_PHONE: {
    keyword: 'THREAT_GIVE_PHONE',
    language: 'en',
    display: '“Give me your phone”',
    meaning: 'Possible coercive demand',
    severity: 'coercive',
  },
  THREAT_SHUT_UP: {
    keyword: 'THREAT_SHUT_UP',
    language: 'en',
    display: '“Shut up”',
    meaning: 'Possible aggressive silencing language',
    severity: 'ambiguous',
  },
  THREAT_DONT_MOVE: {
    keyword: 'THREAT_DONT_MOVE',
    language: 'en',
    display: '“Don’t move”',
    meaning: 'Possible coercive command',
    severity: 'coercive',
  },
  THREAT_KILL_YOU: {
    keyword: 'THREAT_KILL_YOU',
    language: 'en',
    display: '“I will kill you”',
    meaning: 'Possible violent threat',
    severity: 'violent',
  },
  THREAT_CHILLAO_MAT: {
    keyword: 'THREAT_CHILLAO_MAT',
    language: 'hi',
    display: '“Chillao mat”',
    meaning: 'Hindi: possible silencing language',
    severity: 'ambiguous',
  },
  THREAT_PHONE_DE_DO: {
    keyword: 'THREAT_PHONE_DE_DO',
    language: 'hi',
    display: '“Phone de do”',
    meaning: 'Hindi: possible coercive phone demand',
    severity: 'coercive',
  },
  THREAT_CHUP_RAHO: {
    keyword: 'THREAT_CHUP_RAHO',
    language: 'hi',
    display: '“Chup raho”',
    meaning: 'Hindi: possible aggressive silencing language',
    severity: 'ambiguous',
  },
  THREAT_MAAR_DUNGA: {
    keyword: 'THREAT_MAAR_DUNGA',
    language: 'hi',
    display: '“Maar dunga”',
    meaning: 'Hindi: possible violent threat',
    severity: 'violent',
  },
  THREAT_CHITKAR_KORO_NA: {
    keyword: 'THREAT_CHITKAR_KORO_NA',
    language: 'bn',
    display: '“Chitkar koro na”',
    meaning: 'Bengali: possible silencing language',
    severity: 'ambiguous',
  },
  THREAT_PHONE_DAO: {
    keyword: 'THREAT_PHONE_DAO',
    language: 'bn',
    display: '“Phone dao”',
    meaning: 'Bengali: possible coercive phone demand',
    severity: 'coercive',
  },
  THREAT_CHUP_KORO: {
    keyword: 'THREAT_CHUP_KORO',
    language: 'bn',
    display: '“Chup koro”',
    meaning: 'Bengali: possible aggressive silencing language',
    severity: 'ambiguous',
  },
  THREAT_MERE_FELBO: {
    keyword: 'THREAT_MERE_FELBO',
    language: 'bn',
    display: '“Mere felbo”',
    meaning: 'Bengali: possible violent threat',
    severity: 'violent',
  },
};

export function isThreatPhraseKeyword(value: string): value is ThreatPhraseKeyword {
  return Object.prototype.hasOwnProperty.call(THREAT_PHRASES, value);
}

export function getThreatPhrase(
  keyword: ThreatPhraseKeyword,
): ThreatPhraseDefinition {
  return THREAT_PHRASES[keyword];
}

export function scoreThreatLanguageSignal(input: {
  matches: ThreatPhraseMatch[];
  now: number;
  audioDistressScore: number;
  motionScore: number;
  mediaScore: number;
}): ThreatLanguageSignal {
  const recent = input.matches.filter(
    (match) => input.now - match.detectedAt <= THREAT_MATCH_WINDOW_MS,
  );
  if (!recent.length) {
    return {
      active: false,
      confirmed: false,
      factor: null,
      matchCount: 0,
      physicalAgreement: false,
      score: 0,
    };
  }

  const strongest = recent.reduce((current, match) => {
    const phrase = getThreatPhrase(match.keyword);
    return SEVERITY_WEIGHT[phrase.severity] >
      SEVERITY_WEIGHT[getThreatPhrase(current.keyword).severity]
      ? match
      : current;
  });
  const phrase = getThreatPhrase(strongest.keyword);
  const severity = SEVERITY_WEIGHT[phrase.severity];
  const repeated = recent.length >= 2;
  const physicalAgreement =
    input.audioDistressScore >= 0.5 || input.motionScore >= 0.45;
  const likelyMedia =
    input.mediaScore >= 0.45 && input.audioDistressScore < 0.6 && input.motionScore < 0.45;

  let score = repeated ? 0.52 + 0.12 * severity : 0.28 + 0.12 * severity;
  if (physicalAgreement) score += repeated ? 0.12 : 0.06;
  if (likelyMedia) score *= 0.55;
  score = Math.min(Math.max(score, 0), 1);

  return {
    active: true,
    confirmed: repeated && physicalAgreement && !likelyMedia,
    factor: repeated
      ? `${phrase.meaning} repeated and checked against other sensors`
      : `${phrase.meaning} detected; awaiting independent confirmation`,
    matchCount: recent.length,
    physicalAgreement,
    score,
  };
}
