import { requireOptionalNativeModule } from 'expo-modules-core';

export type TimedInterruptionKind = 'call' | 'ride';
export type TimedInterruptionCaller = 'family' | 'office' | 'driver';

export interface TimedInterruptionScheduleResult {
  deadline: number;
  exact: boolean;
}

interface SafeCityInterruptionModule {
  cancelAsync(): Promise<void>;
  dismissAsync(): Promise<void>;
  scheduleAsync(
    kind: TimedInterruptionKind,
    delaySeconds: number,
    callerId: TimedInterruptionCaller,
  ): Promise<TimedInterruptionScheduleResult>;
}

export default requireOptionalNativeModule<SafeCityInterruptionModule>(
  'SafeCityInterruption',
);
