# Background monitoring lifecycle

SafeCity stores the user’s background-protection and voice-keyword choices in
native Android preferences. React state is not the source of truth for whether
the persistent service should restart.

| Event | Motion protection | Distress audio and voice keyword protection |
| --- | --- | --- |
| SafeCity visible | React pipeline at 50 Hz; native copy paused | React 16 kHz pipeline; native copy paused |
| SafeCity backgrounded | Native foreground service | Native 16 kHz foreground microphone service; distress checks follow Background protection and keyword decoding follows Voice keyword SOS |
| App task swiped away | Native service continues; `onTaskRemoved` rearms it | Native service continues; `onTaskRemoved` rearms it |
| Process reclaimed by Android | `START_STICKY` restores the saved choice | `START_STICKY` restores the saved choice |
| Phone reboot or app update | Boot receiver restores batched motion checks | Android 14+ requires one tap on the visible resume notification before microphone checks resume |
| User turns a switch off | Stops and clears that saved choice | Stops and clears that saved choice |
| User force-stops SafeCity | Android stops the service and receivers | Android stops the service and receivers |

## Battery policy

- Only one sensor pipeline owns monitoring at a time; the React and native
  pipelines do not process the same motion or microphone stream together.
- Motion runs at 50 Hz accelerometer / 40 Hz gyroscope while interactive.
- Screen-off or battery-saver mode uses 25 Hz / 20 Hz with 750 ms sensor-hub
  batching. Sensor timestamps, rather than callback delivery time, preserve the
  fall timing calculation.
- Wake-up sensor variants are preferred when the phone provides them. No
  permanent CPU wake lock is held.
- Keyword audio stays at 16 kHz mono with one inference thread. Duty cycling is
  intentionally not used because it creates blind intervals for short words.
- Temporary model or microphone failures retry after 30 seconds with exponential
  backoff capped at 15 minutes, without changing the user’s enabled switch.

Android always displays a foreground-service notification while background
protection is running.
