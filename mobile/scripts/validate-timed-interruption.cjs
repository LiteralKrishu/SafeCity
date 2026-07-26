const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const appConfig = JSON.parse(read('app.json')).expo;
const screen = read('app/timed-interruption.tsx');
const service = read('src/services/timed-interruption.ts');
const receiver = read(
  'modules/safecity-interruption/android/src/main/java/com/safecity/interruption/SafeCityInterruptionReceiver.kt',
);
const manifest = read(
  'modules/safecity-interruption/android/src/main/AndroidManifest.xml',
);
const fakeCall = read('app/fake-call.tsx');
const rideCover = read('app/cover-story.tsx');
const map = read('src/components/SafetyMap.tsx');

assert.equal(appConfig.version, '3.0.1');
assert.equal(appConfig.android.versionCode, 3);
assert.match(screen, /How to use it/);
assert.match(screen, /Incoming call/);
assert.match(screen, /Ride arrived/);
assert.match(service, /\/fake-call\?autoStart=1&caller=/);
assert.match(service, /\/cover-story\?interruption=1/);
assert.match(receiver, /setFullScreenIntent\(fullScreenIntent, true\)/);
assert.match(receiver, /DEFAULT_RINGTONE_URI/);
assert.match(receiver, /FLAG_INSISTENT/);
assert.match(receiver, /setExactAndAllowWhileIdle/);
assert.match(manifest, /SafeCityInterruptionReceiver/);
assert.match(fakeCall, /startedByTimer \? 'ringing' : 'setup'/);
assert.match(rideCover, /Your ride has arrived|cover\.rideTitle/);
assert.match(map, /Math\.log2\(distance \/ start\.distance\)/);
assert.match(map, /requestAnimationFrame\(tick\)/);
assert.doesNotMatch(map, /Math\.round\(Math\.log2/);

console.log(
  JSON.stringify(
    {
      versionCode: appConfig.android.versionCode,
      versionName: appConfig.version,
      interruptionChoices: ['call', 'ride'],
      fullScreenAndroidTimer: true,
      loopingCallerRingtone: true,
      smoothContinuousMapZoom: true,
    },
    null,
    2,
  ),
);
