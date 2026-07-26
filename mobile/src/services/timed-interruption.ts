import * as Notifications from 'expo-notifications';

import SafeCityInterruption, {
  type TimedInterruptionCaller,
  type TimedInterruptionKind,
} from '../../modules/safecity-interruption';

export type { TimedInterruptionCaller, TimedInterruptionKind };

export interface TimedInterruptionResult {
  deadline: number;
  exact: boolean;
  opensAutomatically: boolean;
  fallbackNotificationId: string | null;
}

export function interruptionPath(
  kind: TimedInterruptionKind,
  callerId: TimedInterruptionCaller,
): string {
  return kind === 'call'
    ? `/fake-call?autoStart=1&caller=${callerId}`
    : '/cover-story?interruption=1';
}

export async function scheduleTimedInterruption(
  kind: TimedInterruptionKind,
  delaySeconds: number,
  callerId: TimedInterruptionCaller,
): Promise<TimedInterruptionResult> {
  if (SafeCityInterruption) {
    const result = await SafeCityInterruption.scheduleAsync(
      kind,
      delaySeconds,
      callerId,
    );
    return {
      deadline: result.deadline,
      exact: result.exact,
      opensAutomatically: true,
      fallbackNotificationId: null,
    };
  }

  const deadline = Date.now() + delaySeconds * 1_000;
  const fallbackNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: kind === 'call' ? 'Incoming call' : 'Your ride is here',
      body:
        kind === 'call'
          ? `${callerId === 'family' ? 'Maa' : callerId === 'office' ? 'Office' : 'Driver'} is calling`
          : 'Arjun is waiting at your pickup point',
      data: {
        timedInterruption: true,
        interruptionPath: interruptionPath(kind, callerId),
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      repeats: false,
    },
  });
  return {
    deadline,
    exact: false,
    opensAutomatically: false,
    fallbackNotificationId,
  };
}

export async function cancelTimedInterruption(
  fallbackNotificationId?: string | null,
): Promise<void> {
  if (SafeCityInterruption) {
    await SafeCityInterruption.cancelAsync();
    return;
  }
  if (fallbackNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(fallbackNotificationId);
  }
}

export async function dismissTimedInterruption(): Promise<void> {
  await SafeCityInterruption?.dismissAsync();
}
